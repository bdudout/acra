/**
 * GET    /api/controles/campagnes/[id]/rapports/[rapportId] — télécharger un rapport.
 * DELETE /api/controles/campagnes/[id]/rapports/[rapportId] — supprimer un rapport.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import { getDocumentStorage } from '@/lib/document-storage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string; rapportId: string }> }
interface RapportMeta { id: string; nom: string; mime: string; taille: number; storageKey: string }

async function load(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return { error: NextResponse.json({ error: 'org_absente' }, { status: 400 }) }
  const cfg = await getOrgConfig(orgId)
  if (!cfg.controlePermanentActive) return { error: NextResponse.json({ error: 'module_inactif' }, { status: 403 }) }
  const campagne = await prisma.campagneControle.findFirst({ where: { id, organizationId: orgId }, select: { id: true, rapports: true } })
  if (!campagne) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  return { userId, userRole: scope.role, orgId, secondeLigneActive: cfg.secondeLigneActive, campagne }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, rapportId } = await params
  const c = await load(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  const rapports = (Array.isArray(c.campagne.rapports) ? c.campagne.rapports : []) as unknown as RapportMeta[]
  const r = rapports.find(x => x.id === rapportId)
  if (!r) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const bytes = await (await getDocumentStorage()).get(r.storageKey).catch(() => null)
  if (!bytes) return NextResponse.json({ error: 'Fichier absent' }, { status: 404 })
  return new NextResponse(new Uint8Array(bytes), {
    headers: { 'Content-Type': r.mime || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${encodeURIComponent(r.nom)}"` },
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, rapportId } = await params
  const c = await load(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
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
}
