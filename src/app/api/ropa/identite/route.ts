// ─── Registre des traitements : identité du responsable (RGPD art. 30 §1 a) ───
// GET : saisie de l'organisation active + DPO désignés dans ACRA (repris automatiquement) + identité effective.
// PUT : enregistre la saisie (responsable, représentant, DPO en champ libre). DPO / ADMIN ; journalisé.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageRopa } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { sanitizeIdentite } from '@/lib/ropa-identite'
import { lireIdentite } from '@/lib/ropa-identite.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const GET = withAccess({ org: 'active', allow: canManageRopa }, async (_req, { orgId }) => {
  return NextResponse.json(await lireIdentite(orgId))
})

export const PUT = withAccess({ org: 'active', allow: canManageRopa, rateLimit: { bucket: 'ropa' } }, async (req, { user, role, orgId }) => {
  const saisie = sanitizeIdentite(await req.json().catch(() => ({})))
  await prisma.ropaIdentite.upsert({ where: { organizationId: orgId }, create: { organizationId: orgId, ...saisie }, update: saisie })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'ropa-identite', action: 'update' } })
  return NextResponse.json(await lireIdentite(orgId))
})
