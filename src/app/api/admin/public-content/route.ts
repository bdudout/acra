import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAdminInstance } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { requireInstanceAdmin } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'

// GET /api/admin/public-content — contenu public configuré de l'instance (brut).
// Vides ⇒ défauts i18n appliqués côté client (resolvePublicContent).
export async function GET() {
  const g = await requireInstanceAdmin()
  if (g.error) return g.error
  const cfg = await prisma.configuration.findUnique({
    where: { id: 'global' },
    select: { publicNotice: true, publicContactUrl: true, publicContactLabel: true },
  })
  return NextResponse.json({
    publicNotice: cfg?.publicNotice ?? '',
    publicContactUrl: cfg?.publicContactUrl ?? '',
    publicContactLabel: cfg?.publicContactLabel ?? '',
  })
}

// PUT /api/admin/public-content — définit le contenu public (SUPER_ADMIN).
export const PUT = withAccess({ org: 'none', rateLimit: { bucket: 'admin-public-content' } }, async (req, { user: u }) => {
  if (!canAdminInstance({ id: u.id, role: u.role })) {
    return NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    publicNotice?: unknown; publicContactUrl?: unknown; publicContactLabel?: unknown
  }
  const clean = (v: unknown, max: number) => {
    const s = typeof v === 'string' ? v.trim().slice(0, max) : ''
    return s.length ? s : null // vide ⇒ retour au défaut i18n
  }
  const data = {
    publicNotice: clean(body.publicNotice, 300),
    publicContactUrl: clean(body.publicContactUrl, 300),
    publicContactLabel: clean(body.publicContactLabel, 60),
  }

  await prisma.configuration.update({ where: { id: 'global' }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: u.id, userRole: u.role, ip: getClientIp(req),
    details: { scope: 'publicContent', ...data },
  })
  return NextResponse.json({ ok: true, ...data })
})
