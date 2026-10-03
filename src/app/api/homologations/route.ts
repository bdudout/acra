import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere, getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { canPreparerHomologation, etatValidite, piecesInitiales, sanitizeDuree } from '@/lib/homologation'
import { auditLog, getClientIp } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

// ─── Homologations (registre) ─────────────────────────────────────────────────
// Module optionnel (homologationsActive, 3 niveaux). Spec : docs/specs/protection-sociale-specs.md (P2).

// GET /api/homologations — registre des homologations des organisations visibles, avec l'état de validité.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  if (!(await getOrgConfig(orgId)).homologationsActive) return NextResponse.json({ error: 'Module inactif' }, { status: 403 })

  const rows = await prisma.homologation.findMany({
    where: scope.scope.isSuperAdmin ? {} : { organizationId: { in: scope.scope.visibleOrgIds } },
    include: { analyse: { select: { nom: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  const now = new Date()
  return NextResponse.json({
    role: scope.role,
    items: rows.map(h => ({ ...h, analyseNom: h.analyse?.nom ?? null, analyse: undefined, etat: etatValidite(h, now) })),
  })
}

// POST /api/homologations — ouvrir un dossier d'homologation (RSSI, gestionnaire des risques, administrateur).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  if (!(await getOrgConfig(orgId)).homologationsActive) return NextResponse.json({ error: 'Module inactif' }, { status: 403 })
  if (!canPreparerHomologation(scope.role)) return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const systeme = typeof body.systeme === 'string' ? body.systeme.trim().slice(0, 200) : ''
  if (!systeme) return NextResponse.json({ error: 'Le système à homologuer est requis' }, { status: 400 })
  const perimetre = typeof body.perimetre === 'string' && body.perimetre.trim() ? body.perimetre.trim().slice(0, 2000) : null

  // Analyse de risques rattachée : accessible ET de la même organisation (sinon 404, pas de fuite d'existence).
  let analyseId: string | null = null
  if (typeof body.analyseId === 'string' && body.analyseId) {
    const a = await prisma.analyse.findFirst({ where: await analyseAccessWhere(userId, instanceRole, body.analyseId), select: { id: true, organizationId: true, deletedAt: true } })
    if (!a || a.deletedAt || a.organizationId !== orgId) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })
    analyseId = a.id
  }

  const created = await prisma.homologation.create({
    data: {
      organizationId: orgId, analyseId, systeme, perimetre, statut: 'PREPARATION', preparePar: userId,
      dureeMois: sanitizeDuree(body.dureeMois), pieces: piecesInitiales() as never, reserves: [] as never,
    },
  })
  await auditLog('HOMOLOGATION_CREATED', { userId, userRole: scope.role, targetId: created.id, targetType: 'homologation', ip: getClientIp(req), details: { systeme, analyseId } })
  return NextResponse.json(created, { status: 201 })
}
