/**
 * GET    /api/audit/missions/[id]/rapports/[rapportId] — télécharger un rapport.
 * DELETE /api/audit/missions/[id]/rapports/[rapportId] — supprimer un rapport.
 */
import { accesResultats } from '@/lib/acces-resultats.server'
import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import type { SessionUser } from '@/lib/route-guard.server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope, roleSurRessource } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutEcrireAudit, type UserRole } from '@/lib/permissions'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface RapportMeta { id: string; nom: string; mime: string; taille: number; storageKey: string }

// Mission cherchée dans le périmètre visible, sans organisation active exigée : `org: 'none'`.
async function load(user: SessionUser, id: string) {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const mission = await prisma.auditMission.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true, rapports: true, responsable: true },
  })
  if (!mission) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  // Rôle EFFECTIF dans l'organisation DE LA RESSOURCE, jamais celui de l'org active (CWE-863).
  const userRole = await roleSurRessource(userId, user.role, mission.organizationId)
  const cfg = await getOrgConfig(mission.organizationId)
  if (!cfg.auditInterneActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { userId, userRole, mission }
}

// GET /api/audit/missions/[id]/rapports/[rapportId] — télécharge un rapport archivé d'une mission d'audit.
export const GET = withAccess({ org: 'none' }, async (_req, { user, params: { id, rapportId } }) => {
  const c = await load(user, id)
  if (c.error) return c.error
  // Rapport de mission : interlocuteurs concernés seulement (lecture globale ou responsable de la mission).
  const acces = await accesResultats(c.userId, c.userRole as UserRole)
  if (!acces.tout && !acces.concerne(c.mission.responsable)) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const rapports = (Array.isArray(c.mission.rapports) ? c.mission.rapports : []) as unknown as RapportMeta[]
  const r = rapports.find(x => x.id === rapportId)
  if (!r) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const storage = await getDocumentStorage()
  const bytes = await storage.get(r.storageKey).catch(() => null)
  if (!bytes) return NextResponse.json({ error: 'Fichier absent' }, { status: 404 })
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': r.mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(r.nom)}"`,
    },
  })
})

// DELETE /api/audit/missions/[id]/rapports/[rapportId] — supprime un rapport archivé d'une mission d'audit.
export const DELETE = withAccess({ org: 'none', rateLimit: { bucket: 'audit-rapports' } }, async (req, { user, params: { id, rapportId } }) => {
  const c = await load(user, id)
  if (c.error) return c.error
  if (!peutEcrireAudit(c.userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const rapports = (Array.isArray(c.mission.rapports) ? c.mission.rapports : []) as unknown as RapportMeta[]
  const r = rapports.find(x => x.id === rapportId)
  if (!r) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const storage = await getDocumentStorage()
  await storage.delete(r.storageKey).catch(() => {})
  const restants = rapports.filter(x => x.id !== rapportId)
  await prisma.auditMission.update({ where: { id }, data: { rapports: restants as unknown as Prisma.InputJsonValue } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.mission.organizationId, ip: getClientIp(req),
    details: { scope: 'audit-mission', action: 'rapport-delete', id, rapportId },
  })
  return NextResponse.json({ ok: true })
})
