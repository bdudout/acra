import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { peutLireRapports, peutEcrireRapports } from '@/lib/rapport-acces'
import { rapportsDisponibles, validerPeriode, RAPPORT_CODES, type RapportCode } from '@/lib/rapport-model'
import { genererContenuRapport } from '@/lib/rapports.server'
import { rateLimit, LIMIT_API_WRITE } from '@/lib/rate-limit'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function contexte(): Promise<{ error: NextResponse } | { userId: string; role: UserRole; orgId: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return { error: NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 }) }
  return { userId, role: scope.role as UserRole, orgId: scope.activeOrgId }
}

// GET /api/rapports — éditions de l'organisation active (sans le contenu), rapports disponibles.
export async function GET(): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error
  if (!peutLireRapports(c.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const cfg = await getOrgConfig(c.orgId)
  const editions = await prisma.rapportEdition.findMany({
    where: { organizationId: c.orgId }, orderBy: { createdAt: 'desc' }, take: 200,
    select: { id: true, code: true, statut: true, periodeDebut: true, periodeFin: true, langue: true, createdAt: true, createdById: true, valideLe: true, diffuseLe: true },
  })
  return NextResponse.json({ editions, disponibles: rapportsDisponibles(cfg), canWrite: peutEcrireRapports(c.role) })
}

// POST /api/rapports — génère une édition (BROUILLON) : contenu calculé et figé pour la période.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error
  if (!peutEcrireRapports(c.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const rl = await rateLimit(`rapports:${c.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const cfg = await getOrgConfig(c.orgId)
  const code = (RAPPORT_CODES as readonly string[]).includes(body.code) ? (body.code as RapportCode) : null
  if (!code || !rapportsDisponibles(cfg).some(r => r.code === code)) return NextResponse.json({ error: 'rapport_indisponible' }, { status: 400 })
  const erreur = validerPeriode(body.periode ?? {})
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const langue = ['fr', 'en', 'de', 'es', 'it'].includes(body.langue) ? (body.langue as string) : 'fr'
  const periode = { debut: body.periode.debut as string, fin: body.periode.fin as string }

  const now = new Date()
  const contenu = await genererContenuRapport(code, c.orgId, cfg, periode, langue, now)
  const edition = await prisma.rapportEdition.create({
    data: {
      organizationId: c.orgId, code, langue, statut: 'BROUILLON', createdById: c.userId,
      periodeDebut: new Date(`${periode.debut}T00:00:00Z`), periodeFin: new Date(`${periode.fin}T00:00:00Z`),
      contenu: contenu as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, code: true, statut: true },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req),
    details: { scope: 'rapport', action: 'generer', id: edition.id, code, periode },
  })
  return NextResponse.json(edition, { status: 201 })
}
