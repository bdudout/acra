/**
 * POST /api/controles/campagnes/[id]/rapports — uploader un rapport/preuve rattaché
 * à une campagne de contrôle. Multipart (champ `file`). 2ᵉ ligne (peutDefinir2eLigne).
 * Octets hors base (document-storage) ; métadonnées dans le champ JSON `rapports`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID, createHash } from 'node:crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import { mimeAutorise, sanitizeFilename, storageKeyFor, MAX_DOCUMENT_SIZE } from '@/lib/document'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

async function loadInScope(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return { error: NextResponse.json({ error: 'org_absente' }, { status: 400 }) }
  const cfg = await getOrgConfig(orgId)
  if (!cfg.controlePermanentActive) return { error: NextResponse.json({ error: 'module_inactif' }, { status: 403 }) }
  if (!peutDefinir2eLigne(scope.role, { secondeLigneActive: cfg.secondeLigneActive })) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  const campagne = await prisma.campagneControle.findFirst({ where: { id, organizationId: orgId }, select: { id: true, rapports: true } })
  if (!campagne) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  return { userId, userRole: scope.role, orgId, campagne }
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'fichier_requis' }, { status: 400 })
  if (file.size > MAX_DOCUMENT_SIZE) return NextResponse.json({ error: 'fichier_trop_gros' }, { status: 400 })
  if (!mimeAutorise(file.type)) return NextResponse.json({ error: 'mime_interdit' }, { status: 400 })

  const rapportId = randomUUID()
  const bytes = Buffer.from(await file.arrayBuffer())
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
}
