import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAdminInstance } from '@/lib/permissions'
import { sanitizeModulesPolicy, GOVERNABLE_MODULES, MODULE_POLICIES } from '@/lib/module-policy'
import { auditLog, getClientIp } from '@/lib/logger'

// Politique d'activation des modules au niveau instance (SUPER_ADMIN).
// GET : lecture ; PUT : mise à jour (map { <module>: 'PER_ORG'|'FORCE_ON'|'FORCE_OFF' }).

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canAdminInstance({ id: (session.user as any).id, role: (session.user as any).role })) {
    return NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = await (prisma as any).configuration.findUnique({ where: { id: 'global' }, select: { modulesPolicy: true } })
  return NextResponse.json({ modulesPolicy: sanitizeModulesPolicy(cfg?.modulesPolicy), modules: GOVERNABLE_MODULES, etats: MODULE_POLICIES })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as any).id
  const userRole = (session.user as any).role
  if (!canAdminInstance({ id: userId, role: userRole })) {
    return NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({})) as { modulesPolicy?: unknown }
  const modulesPolicy = sanitizeModulesPolicy(body.modulesPolicy)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).configuration.update({ where: { id: 'global' }, data: { modulesPolicy } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, ip: getClientIp(req),
    details: { scope: 'modules-policy', modulesPolicy },
  })
  return NextResponse.json({ ok: true, modulesPolicy })
}
