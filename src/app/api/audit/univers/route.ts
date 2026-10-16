import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { withAccess } from '@/lib/with-access.server'
import { peutEcrireAudit } from '@/lib/audit-acces'
import { cleanUniversInput } from '@/lib/audit-l4'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/audit/univers — univers d'audit de l'organisation active (lecture ouverte).
export const GET = withAccess({ org: 'active' }, async (_req, { role, orgId }) => {
  if (!(await getOrgConfig(orgId)).auditInterneActive) return NextResponse.json({ active: false, univers: [] })
  const univers = await prisma.auditUnivers.findMany({ where: { organizationId: orgId }, orderBy: [{ risque: 'desc' }, { intitule: 'asc' }], take: 500 })
  return NextResponse.json({ active: true, canWrite: peutEcrireAudit(role), univers })
})

// POST /api/audit/univers — ajouter une entrée (auditeur / admin).
// Module vérifié AVANT le rôle (ordre conservé) : le contrôle de rôle reste dans le handler.
export const POST = withAccess({ org: 'active', rateLimit: { bucket: 'audit-univers' } }, async (req, { user, role, orgId }) => {
  const c = { userId: user.id, role, orgId }
  if (!(await getOrgConfig(c.orgId)).auditInterneActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!peutEcrireAudit(c.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const data = cleanUniversInput(body)
  if (!data.intitule) return NextResponse.json({ error: 'intitule_requis' }, { status: 400 })
  if (data.processusId && !(await prisma.processus.findFirst({ where: { id: data.processusId, organizationId: c.orgId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'processus_invalide' }, { status: 400 })
  }
  const univers = await prisma.auditUnivers.create({ data: { ...data, organizationId: c.orgId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), details: { scope: 'audit', action: 'univers:create', id: univers.id } })
  return NextResponse.json(univers, { status: 201 })
})
