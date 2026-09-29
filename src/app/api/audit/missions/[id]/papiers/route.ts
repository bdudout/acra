import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { peutEcrireAudit } from '@/lib/audit-acces'
import { sanitizePapiers, appliquerPapiers, type CommandePapier } from '@/lib/papiers-travail'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }
const ACTIONS = ['AJOUTER', 'MODIFIER', 'SUPPRIMER', 'SOUMETTRE', 'REVOIR', 'RENVOYER']

// Papiers de travail : documents INTERNES de l'audit — lecture et écriture réservées à l'audit (et ADMIN).
async function charger(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const mission = await prisma.auditMission.findFirst({ where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) }, select: { id: true, organizationId: true, papiers: true, updatedAt: true } })
  if (!mission) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  if (!(await getOrgConfig(mission.organizationId)).auditInterneActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  const role = scope.role as UserRole
  if (!peutEcrireAudit(role)) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  return { userId, role, mission }
}

async function noms(ids: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(ids)]
  if (!uniq.length) return {}
  const rows = await prisma.user.findMany({ where: { id: { in: uniq } }, select: { id: true, name: true, email: true } })
  return Object.fromEntries(rows.map(u => [u.id, u.name || u.email]))
}

// GET /api/audit/missions/[id]/papiers
export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const c = await charger((await params).id)
  if ('error' in c) return c.error as NextResponse
  const papiers = sanitizePapiers(c.mission.papiers)
  return NextResponse.json({ papiers, utilisateurs: await noms(papiers.flatMap(p => [p.preparePar, ...(p.revuePar ? [p.revuePar] : [])])), moi: c.userId })
}

// POST /api/audit/missions/[id]/papiers — { action: AJOUTER | MODIFIER | SUPPRIMER | SOUMETTRE | REVOIR | RENVOYER, … }
export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const id = (await params).id
  const c = await charger(id)
  if ('error' in c) return c.error as NextResponse
  const body = await req.json().catch(() => ({}))
  if (!ACTIONS.includes(body.action)) return NextResponse.json({ error: 'action_invalide' }, { status: 400 })

  const r = appliquerPapiers(sanitizePapiers(c.mission.papiers), body as CommandePapier, { acteur: c.userId, now: new Date(), newId: () => randomUUID() })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  // Écriture optimiste : si la mission a changé entre la lecture et l'écriture, on refuse (409).
  const w = await prisma.auditMission.updateMany({ where: { id, updatedAt: c.mission.updatedAt }, data: { papiers: r.papiers as unknown as Prisma.InputJsonValue } })
  if (w.count === 0) return NextResponse.json({ error: 'conflit' }, { status: 409 })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.mission.organizationId, ip: getClientIp(req), details: { scope: 'audit', action: `papier:${body.action}`, id } })
  return NextResponse.json({ papiers: r.papiers })
}
