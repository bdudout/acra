import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAdminInstance } from '@/lib/permissions'
import { sanitizeModulesPolicy, GOVERNABLE_MODULES, MODULE_POLICIES } from '@/lib/module-policy'
import { auditLog, getClientIp } from '@/lib/logger'
import { requireInstanceAdmin } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'

// Politique d'activation des modules au niveau instance (SUPER_ADMIN).
// GET : lecture ; PUT : mise à jour (map { <module>: 'PER_ORG'|'FORCE_ON'|'FORCE_OFF' }).

// GET /api/admin/modules-policy — lit la politique d'instance d'activation des modules (SUPER_ADMIN).
export async function GET() {
  const g = await requireInstanceAdmin()
  if (g.error) return g.error
  const cfg = await prisma.configuration.findUnique({ where: { id: 'global' }, select: { modulesPolicy: true } })
  return NextResponse.json({ modulesPolicy: sanitizeModulesPolicy(cfg?.modulesPolicy), modules: GOVERNABLE_MODULES, etats: MODULE_POLICIES })
}

// PUT /api/admin/modules-policy — met à jour la politique d'instance (PER_ORG/FORCE_ON/FORCE_OFF) par module (SUPER_ADMIN).
export const PUT = withAccess({ org: 'none', rateLimit: { bucket: 'admin-modules-policy' } }, async (req, { user }) => {
  const userId = user.id
  const userRole = user.role
  if (!canAdminInstance({ id: userId, role: userRole })) {
    return NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({})) as { modulesPolicy?: unknown }
  const modulesPolicy = sanitizeModulesPolicy(body.modulesPolicy)
  await prisma.configuration.update({ where: { id: 'global' }, data: { modulesPolicy } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, ip: getClientIp(req),
    details: { scope: 'modules-policy', modulesPolicy },
  })
  return NextResponse.json({ ok: true, modulesPolicy })
})
