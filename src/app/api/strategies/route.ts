// ─── /api/strategies — stratégies cyber / IT / résilience de l'organisation active (lot S1a) ──
// GET : liste (lecture globale du dispositif) ; POST : création en BROUILLON v1 (rédacteurs). Module `strategieActive`.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { peutRedigerStrategie, peutVoirStrategie } from '@/lib/permissions'
import { extraireIdentifiants, strategieCreateSchema } from '@/lib/strategie'
import { configStrategie, donneesIdentifiants, echec } from '@/lib/strategie.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const GET = withAccess({ org: 'active', allow: peutVoirStrategie }, async (_req, { orgId }) => {
  if (!(await configStrategie(orgId))) return echec(404, 'module_inactif')
  const strategies = await prisma.strategie.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
  })
  return NextResponse.json({ strategies })
})

export const POST = withAccess(
  { org: 'active', allow: peutRedigerStrategie, rateLimit: { bucket: 'strategies' }, body: strategieCreateSchema },
  async (req, { user, role, orgId, body }) => {
    if (!(await configStrategie(orgId))) return echec(404, 'module_inactif')
    const ex = extraireIdentifiants(body)
    if (!ex.ok) return echec(400, ex.error)
    const strategie = await prisma.strategie.create({
      data: {
        organizationId: orgId, titre: body.titre, description: body.description, type: body.type,
        periodeDebut: body.periodeDebut ?? null, periodeFin: body.periodeFin ?? null,
        statut: 'BROUILLON', version: 1, createdById: user.id, ...donneesIdentifiants(ex.ids),
      },
    })
    await auditLog('STRATEGIE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie', targetId: strategie.id, details: { action: 'create' } })
    return NextResponse.json({ strategie }, { status: 201 })
  },
)
