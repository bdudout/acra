// ─── POST /api/strategies/[id]/archiver — VALIDEE → ARCHIVEE (fin de période, sans nouvelle version) — lot S1a ──
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { peutValiderStrategie } from '@/lib/permissions'
import { transitionAutorisee } from '@/lib/strategie'
import { contexteStrategie, echec } from '@/lib/strategie.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const POST = withAccess(
  { org: 'active', allow: peutValiderStrategie, rateLimit: { bucket: 'strategies' } },
  async (req, { user, role, orgId, params: { id } }) => {
    const c = await contexteStrategie(orgId, id)
    if ('erreur' in c) return c.erreur
    if (!transitionAutorisee(c.strategie.statut, 'ARCHIVEE')) return echec(409, 'transition_invalide')
    const { count } = await prisma.strategie.updateMany({ where: { id, organizationId: orgId, statut: 'VALIDEE' }, data: { statut: 'ARCHIVEE' } })
    if (!count) return echec(409, 'transition_invalide')
    await auditLog('STRATEGIE_ARCHIVED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie', targetId: id, details: { action: 'archive' } })
    return NextResponse.json({ ok: true, statut: 'ARCHIVEE' })
  },
)
