import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutGererDocuments } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// DELETE /api/documents/[id] — supprime le document (métadonnées + blob).
export const DELETE = withAccess({ org: 'active', allow: peutGererDocuments, rateLimit: { bucket: 'documents' } }, async (req, { user, role, orgId, params: { id } }) => {
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })

  const doc = await prisma.document.findFirst({ where: { id, organizationId: orgId, analyseId: null }, select: { id: true, storageKey: true } })
  if (!doc) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  await prisma.document.delete({ where: { id } })
  const storage = await getDocumentStorage()
  await storage.delete(doc.storageKey).catch(() => {}) // blob best-effort (la métadonnée fait foi)

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'document', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
})
