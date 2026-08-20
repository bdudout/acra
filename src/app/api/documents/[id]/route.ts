import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { peutGererDocuments } from '../route'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

// DELETE /api/documents/[id] — supprime le document (métadonnées + blob).
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'org_absente' }, { status: 400 })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })
  if (!peutGererDocuments(scope.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const doc = await prisma.document.findFirst({ where: { id, organizationId: orgId }, select: { id: true, storageKey: true } })
  if (!doc) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  await prisma.document.delete({ where: { id } })
  const storage = await getDocumentStorage()
  await storage.delete(doc.storageKey).catch(() => {}) // blob best-effort (la métadonnée fait foi)

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: scope.role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'document', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
}
