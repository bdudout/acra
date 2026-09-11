/**
 * POST /api/audit/missions/[id]/rapports — uploader un rapport/preuve (PDF, doc…)
 * rattaché à une mission d'audit. Multipart (champ `file`). Auditeur / admin.
 * Les octets vivent hors base (document-storage) ; seules les métadonnées sont
 * stockées dans le champ JSON `rapports` de la mission.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID, createHash } from 'node:crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { mimeAutorise, sanitizeFilename, storageKeyFor, MAX_DOCUMENT_SIZE } from '@/lib/document'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

async function loadInScope(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const userRole = scope.role
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const mission = await prisma.auditMission.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true, rapports: true },
  })
  if (!mission) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const cfg = await getOrgConfig(mission.organizationId)
  if (!cfg.auditInterneActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  if (!(userRole === 'AUDITEUR' || isAdminRole(userRole))) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  return { userId, userRole, mission }
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
  const storageKey = storageKeyFor(c.mission.organizationId, `audit-${id}-${rapportId}`, file.name)
  const storage = await getDocumentStorage()
  await storage.put(storageKey, bytes, file.type)

  const entry = {
    id: rapportId, nom: sanitizeFilename(file.name), mime: file.type, taille: file.size,
    storageKey, checksum, uploadedLe: new Date().toISOString(), uploadedBy: c.userId,
  }
  const rapports = [...(Array.isArray(c.mission.rapports) ? (c.mission.rapports as unknown[]) : []), entry]
  await prisma.auditMission.update({ where: { id }, data: { rapports: rapports as unknown as Prisma.InputJsonValue } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.mission.organizationId, ip: getClientIp(req),
    details: { scope: 'audit-mission', action: 'rapport-upload', id, rapportId, taille: file.size },
  })
  return NextResponse.json(entry, { status: 201 })
}
