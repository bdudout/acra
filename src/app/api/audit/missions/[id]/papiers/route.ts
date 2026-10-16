import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { withAccess } from '@/lib/with-access.server'
import type { SessionUser } from '@/lib/route-guard.server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope, roleSurRessource } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { peutEcrireAudit } from '@/lib/audit-acces'
import { sanitizePapiers, appliquerPapiers, type CommandePapier } from '@/lib/papiers-travail'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const ACTIONS = ['AJOUTER', 'MODIFIER', 'SUPPRIMER', 'SOUMETTRE', 'REVOIR', 'RENVOYER']

// Papiers de travail : documents INTERNES de l'audit — lecture et écriture réservées à l'audit (et ADMIN).
// Mission cherchée dans le périmètre visible, sans organisation active exigée : `org: 'none'`.
async function charger(user: SessionUser, id: string) {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const mission = await prisma.auditMission.findFirst({ where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) }, select: { id: true, organizationId: true, papiers: true, updatedAt: true } })
  if (!mission) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  if (!(await getOrgConfig(mission.organizationId)).auditInterneActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  // Rôle EFFECTIF dans l'organisation DE LA RESSOURCE, jamais celui de l'org active (CWE-863).
  const role = await roleSurRessource(userId, user.role, mission.organizationId)
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
export const GET = withAccess({ org: 'none' }, async (_req, { user, params: { id } }) => {
  const c = await charger(user, id)
  if ('error' in c) return c.error as NextResponse
  const papiers = sanitizePapiers(c.mission.papiers)
  // Rattachements possibles (trame libre) : constats de la mission, pièces de la bibliothèque documentaire (module Conformité).
  const [constats, documents] = await Promise.all([
    prisma.auditConstat.findMany({ where: { missionId: c.mission.id }, select: { id: true, intitule: true }, orderBy: { createdAt: 'asc' } }),
    (await getOrgConfig(c.mission.organizationId)).conformiteActive
      ? prisma.document.findMany({ where: { organizationId: c.mission.organizationId, analyseId: null }, select: { id: true, titre: true, type: true }, orderBy: { titre: 'asc' }, take: 500 })
      : [],
  ])
  return NextResponse.json({ papiers, utilisateurs: await noms(papiers.flatMap(p => [p.preparePar, ...(p.revuePar ? [p.revuePar] : [])])), moi: c.userId, options: { constats, documents } })
})

// POST /api/audit/missions/[id]/papiers — { action: AJOUTER | MODIFIER | SUPPRIMER | SOUMETTRE | REVOIR | RENVOYER, … }
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'audit-papiers' } }, async (req, { user, params: { id } }) => {
  const c = await charger(user, id)
  if ('error' in c) return c.error as NextResponse
  const body = await req.json().catch(() => ({}))
  if (!ACTIONS.includes(body.action)) return NextResponse.json({ error: 'action_invalide' }, { status: 400 })

  // Rattachements limités à la mission (constat) et à l'organisation (pièces) : tout autre identifiant est écarté.
  if ((body.action === 'AJOUTER' || body.action === 'MODIFIER') && body.data && typeof body.data === 'object') {
    const d = body.data as { constatId?: unknown; documentIds?: unknown }
    if (typeof d.constatId === 'string' && d.constatId && !(await prisma.auditConstat.findFirst({ where: { id: d.constatId, missionId: c.mission.id }, select: { id: true } }))) d.constatId = undefined
    if (Array.isArray(d.documentIds) && d.documentIds.length) {
      const ids = d.documentIds.filter((x): x is string => typeof x === 'string').slice(0, 10)
      const ok = new Set((await prisma.document.findMany({ where: { id: { in: ids }, organizationId: c.mission.organizationId, analyseId: null }, select: { id: true } })).map(x => x.id))
      d.documentIds = ids.filter(x => ok.has(x))
    }
  }
  const r = appliquerPapiers(sanitizePapiers(c.mission.papiers), body as CommandePapier, { acteur: c.userId, now: new Date(), newId: () => randomUUID() })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  // Écriture optimiste : si la mission a changé entre la lecture et l'écriture, on refuse (409).
  const w = await prisma.auditMission.updateMany({ where: { id, updatedAt: c.mission.updatedAt }, data: { papiers: r.papiers as unknown as Prisma.InputJsonValue } })
  if (w.count === 0) return NextResponse.json({ error: 'conflit' }, { status: 409 })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.mission.organizationId, ip: getClientIp(req), details: { scope: 'audit', action: `papier:${body.action}`, id } })
  return NextResponse.json({ papiers: r.papiers })
})
