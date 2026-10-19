/**
 * POST /api/controles/campagnes/[id]/rapports — uploader un rapport/preuve rattaché
 * à une campagne de contrôle. Multipart (champ `file`). 2ᵉ ligne (peutDefinir2eLigne).
 * Octets hors base (document-storage) ; métadonnées dans le champ JSON `rapports`.
 */
import { NextResponse } from 'next/server'
import { randomUUID, createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { mimeAutorise, contentMatchesMime, sanitizeFilename, storageKeyFor, MAX_DOCUMENT_SIZE } from '@/lib/document'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function loadInScope(userId: string, role: UserRole, orgId: string, id: string) {
  const cfg = await getOrgConfig(orgId)
  if (!cfg.controlePermanentActive) return { error: NextResponse.json({ error: 'module_inactif' }, { status: 403 }) }
  if (!peutDefinir2eLigne(role, { secondeLigneActive: cfg.secondeLigneActive })) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  const campagne = await prisma.campagneControle.findFirst({ where: { id, organizationId: orgId }, select: { id: true, rapports: true } })
  if (!campagne) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  return { error: null, userId, userRole: role, orgId, campagne }
}

// POST /api/controles/campagnes/[id]/rapports — archive (téléverse) un rapport pour une campagne de contrôle.
export const POST = withAccess({ org: 'active', rateLimit: { bucket: 'campagne-rapports' } }, async (req, { user, role, orgId, params: { id } }) => {
  const c = await loadInScope(user.id, role, orgId, id)
  if (c.error) return c.error

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'fichier_requis' }, { status: 400 })
  if (file.size > MAX_DOCUMENT_SIZE) return NextResponse.json({ error: 'fichier_trop_gros' }, { status: 400 })
  if (!mimeAutorise(file.type)) return NextResponse.json({ error: 'mime_interdit' }, { status: 400 })

  const rapportId = randomUUID()
  const bytes = Buffer.from(await file.arrayBuffer())
  if (!contentMatchesMime(file.type, bytes.subarray(0, 1024))) return NextResponse.json({ error: 'mime_interdit' }, { status: 400 })
  const checksum = createHash('sha256').update(bytes).digest('hex')
  const storageKey = storageKeyFor(c.orgId, `campagne-${id}-${rapportId}`, file.name)
  const storage = await getDocumentStorage()
  await storage.put(storageKey, bytes, file.type)

  const entry = {
    id: rapportId, nom: sanitizeFilename(file.name), mime: file.type, taille: file.size,
    storageKey, checksum, uploadedLe: new Date().toISOString(), uploadedBy: c.userId,
  }
  const rapports = [...(Array.isArray(c.campagne.rapports) ? (c.campagne.rapports as unknown[]) : []), entry]
  await prisma.campagneControle.update({ where: { id }, data: { rapports: rapports as unknown as Prisma.InputJsonValue } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.orgId, ip: getClientIp(req),
    details: { scope: 'campagne-controle', action: 'rapport-upload', id, rapportId, taille: file.size },
  })
  return NextResponse.json(entry, { status: 201 })
})
