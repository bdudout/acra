/**
 * GET    /api/controles/campagnes/[id]/rapports/[rapportId] — télécharger un rapport.
 * DELETE /api/controles/campagnes/[id]/rapports/[rapportId] — supprimer un rapport.
 */
import { accesResultats } from '@/lib/acces-resultats.server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
interface RapportMeta { id: string; nom: string; mime: string; taille: number; storageKey: string }

async function load(userId: string, role: UserRole, orgId: string, id: string) {
  const cfg = await getOrgConfig(orgId)
  if (!cfg.controlePermanentActive) return { error: NextResponse.json({ error: 'module_inactif' }, { status: 403 }) }
  const campagne = await prisma.campagneControle.findFirst({ where: { id, organizationId: orgId }, select: { id: true, rapports: true } })
  if (!campagne) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  return { error: null, userId, userRole: role, orgId, secondeLigneActive: cfg.secondeLigneActive, campagne }
}

// GET /api/controles/campagnes/[id]/rapports/[rapportId] — télécharge un rapport archivé d'une campagne de contrôle.
export const GET = withAccess({ org: 'active' }, async (_req, { user, role, orgId, params: { id, rapportId } }) => {
  const c = await load(user.id, role, orgId, id)
  if (c.error) return c.error
  // Rapport de campagne : lecture globale du dispositif seulement.
  if (!(await accesResultats(c.userId, c.userRole as UserRole)).tout) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const rapports = (Array.isArray(c.campagne.rapports) ? c.campagne.rapports : []) as unknown as RapportMeta[]
  const r = rapports.find(x => x.id === rapportId)
  if (!r) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const bytes = await (await getDocumentStorage()).get(r.storageKey).catch(() => null)
  if (!bytes) return NextResponse.json({ error: 'Fichier absent' }, { status: 404 })
  return new NextResponse(new Uint8Array(bytes), {
    headers: { 'Content-Type': r.mime || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${encodeURIComponent(r.nom)}"` },
  })
})

// DELETE /api/controles/campagnes/[id]/rapports/[rapportId] — supprime un rapport archivé d'une campagne de contrôle.
export const DELETE = withAccess({ org: 'active', rateLimit: { bucket: 'campagne-rapports' } }, async (req, { user, role, orgId, params: { id, rapportId } }) => {
  const c = await load(user.id, role, orgId, id)
  if (c.error) return c.error
  if (!peutDefinir2eLigne(c.userRole, { secondeLigneActive: c.secondeLigneActive })) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const rapports = (Array.isArray(c.campagne.rapports) ? c.campagne.rapports : []) as unknown as RapportMeta[]
  const r = rapports.find(x => x.id === rapportId)
  if (!r) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  await (await getDocumentStorage()).delete(r.storageKey).catch(() => {})
  await prisma.campagneControle.update({ where: { id }, data: { rapports: rapports.filter(x => x.id !== rapportId) as unknown as Prisma.InputJsonValue } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.orgId, ip: getClientIp(req),
    details: { scope: 'campagne-controle', action: 'rapport-delete', id, rapportId },
  })
  return NextResponse.json({ ok: true })
})
