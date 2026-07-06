import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canViewAnalyse, canEditAnalyse, type UserRole } from '@/lib/permissions'
import { analyseAccessWhere } from '@/lib/org-context.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { normalizeCycle, nextVersion, formatVersion } from '@/lib/version-analyse'

type Params = { params: Promise<{ id: string }> }

async function loadAnalyse(id: string, userId: string, userRole: UserRole) {
  return prisma.analyse.findFirst({
    where: await analyseAccessWhere(userId, userRole, id),
    include: { accesUtilisateurs: true },
  })
}

// GET /api/analyses/:id/revisions — historique des révisions (label EBIOS RM §3.4)
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  const analyse = await loadAnalyse(id, userId, userRole)
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })
  if (!canViewAnalyse({ id: userId, role: userRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const revisions = await prisma.revisionAnalyse.findMany({
    where: { analyseId: id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    version: formatVersion(analyse.versionMajeure, analyse.versionMineure),
    revisions,
  })
}

// POST /api/analyses/:id/revisions — enregistre une nouvelle révision x.y
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  const analyse = await loadAnalyse(id, userId, userRole)
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })
  if (!canEditAnalyse({ id: userId, role: userRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) {
    return NextResponse.json({ error: 'Accès refusé — édition non autorisée' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const cycle = normalizeCycle(body.cycle)
  const note = body.note != null ? String(body.note).slice(0, 2000) : null
  // Ateliers concernés : entiers 1..5, dédoublonnés et triés.
  const rawAteliers: unknown[] = Array.isArray(body.ateliers) ? body.ateliers : []
  const ateliers: number[] = Array.from(new Set(
    rawAteliers
      .map((n) => Math.floor(Number(n)))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5)
  )).sort((a, b) => a - b)

  const { maj, min } = nextVersion(analyse.versionMajeure, analyse.versionMineure, cycle)
  const version = formatVersion(maj, min)

  const [, revision] = await prisma.$transaction([
    prisma.analyse.update({
      where: { id },
      data: { versionMajeure: maj, versionMineure: min, updatedAt: new Date() },
    }),
    prisma.revisionAnalyse.create({
      data: { analyseId: id, version, cycle, note, ateliers, createdById: userId },
    }),
  ])

  await auditLog('ANALYSE_REVISED', {
    userId,
    targetId: id,
    targetType: 'analyse',
    ip: getClientIp(req),
    details: { version, cycle, ateliers },
  })

  return NextResponse.json({ version, revision })
}
