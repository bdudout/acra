import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAdminInstance } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { requireInstanceAdmin } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'

// GET /api/admin/branding — identité configurée de l'instance (nom + baseline).
// Renvoie les valeurs brutes (vides = défauts i18n appliqués ailleurs).
export async function GET() {
  const g = await requireInstanceAdmin()
  if (g.error) return g.error
  const cfg = await prisma.configuration.findUnique({
    where: { id: 'global' }, select: { appName: true, appBaseline: true },
  })
  return NextResponse.json({ appName: cfg?.appName ?? '', appBaseline: cfg?.appBaseline ?? '' })
}

// PUT /api/admin/branding — définit le nom/baseline de l'instance (SUPER_ADMIN).
export const PUT = withAccess({ org: 'none', rateLimit: { bucket: 'admin-branding' } }, async (req, { user }) => {
  const userId = user.id
  const userRole = user.role
  if (!canAdminInstance({ id: userId, role: userRole })) {
    return NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { appName?: unknown; appBaseline?: unknown }
  const clean = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim().slice(0, 120) : ''
    return s.length ? s : null // vide ⇒ retour au défaut i18n
  }
  const data = { appName: clean(body.appName), appBaseline: clean(body.appBaseline) }

  await prisma.configuration.update({ where: { id: 'global' }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, ip: getClientIp(req),
    details: { scope: 'branding', appName: data.appName, appBaseline: data.appBaseline },
  })
  return NextResponse.json({ ok: true, ...data })
})
