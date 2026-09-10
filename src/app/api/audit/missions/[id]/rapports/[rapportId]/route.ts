/**
 * GET    /api/audit/missions/[id]/rapports/[rapportId] — télécharger un rapport.
 * DELETE /api/audit/missions/[id]/rapports/[rapportId] — supprimer un rapport.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string; rapportId: string }> }

interface RapportMeta { id: string; nom: string; mime: string; taille: number; storageKey: string }

async function load(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const mission = await prisma.auditMission.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true, rapports: true },
  })
  if (!mission) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const cfg = await getOrgConfig(mission.organizationId)
  if (!cfg.auditInterneActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { userId, userRole: scope.role, mission }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, rapportId } = await params
  const c = await load(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
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
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, rapportId } = await params
  const c = await load(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  if (!(c.userRole === 'AUDITEUR' || isAdminRole(c.userRole))) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
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
}
