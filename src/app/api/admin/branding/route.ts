import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAdminInstance } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'

// GET /api/admin/branding — identité configurée de l'instance (nom + baseline).
// Renvoie les valeurs brutes (vides = défauts i18n appliqués ailleurs).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canAdminInstance({ id: (session.user as any).id, role: (session.user as any).role })) {
    return NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = await (prisma as any).configuration.findUnique({
    where: { id: 'global' }, select: { appName: true, appBaseline: true },
  })
  return NextResponse.json({ appName: cfg?.appName ?? '', appBaseline: cfg?.appBaseline ?? '' })
}

// PUT /api/admin/branding — définit le nom/baseline de l'instance (SUPER_ADMIN).
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as any).id
  const userRole = (session.user as any).role
  if (!canAdminInstance({ id: userId, role: userRole })) {
    return NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { appName?: unknown; appBaseline?: unknown }
  const clean = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim().slice(0, 120) : ''
    return s.length ? s : null // vide ⇒ retour au défaut i18n
  }
  const data = { appName: clean(body.appName), appBaseline: clean(body.appBaseline) }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).configuration.update({ where: { id: 'global' }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, ip: getClientIp(req),
    details: { scope: 'branding', appName: data.appName, appBaseline: data.appBaseline },
  })
  return NextResponse.json({ ok: true, ...data })
}
