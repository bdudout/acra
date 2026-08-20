import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { getDocumentStorage } from '@/lib/document-storage'
import { sanitizeFilename } from '@/lib/document'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

// GET /api/documents/[id]/download — flux authentifié du fichier (jamais public).
export async function GET(req: NextRequest, { params }: Params) {
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
  // Lecture ouverte à tout membre du périmètre : les documents de gouvernance sont
  // consultables ; seule leur GESTION (dépôt/suppression) est réservée.

  const doc = await prisma.document.findFirst({ where: { id, organizationId: orgId } })
  if (!doc) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const storage = await getDocumentStorage()
  let bytes: Buffer
  try { bytes = await storage.get(doc.storageKey) } catch {
    return NextResponse.json({ error: 'fichier_absent' }, { status: 410 })
  }

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: scope.role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'document', action: 'download', id },
  })

  const filename = sanitizeFilename(doc.fichierNom)
  return new NextResponse(bytes as unknown as ArrayBuffer, {
    headers: {
      'Content-Type': doc.mime,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(doc.taille),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  })
}
