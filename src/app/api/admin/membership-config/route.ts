// ─── Mode de rattachement des comptes existants (T23) — réglage d'instance ──
// GET : réglage, mode effectif et ouverture de l'instance. PUT { mode?, notify? }.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { requireInstanceAdmin } from '@/lib/route-guard.server'
import { isSignupOpen } from '@/lib/demo-server'
import { MEMBERSHIP_MODES, cleanMembershipMode, resolveMembershipMode } from '@/lib/membership-mode'

export const dynamic = 'force-dynamic'

async function state() {
  const [cfg, instanceOpen] = await Promise.all([
    prisma.configuration.findUnique({ where: { id: 'global' }, select: { membershipMode: true, membershipNotify: true } }),
    isSignupOpen(),
  ])
  const mode = cleanMembershipMode(cfg?.membershipMode)
  return { mode, effective: resolveMembershipMode(mode, instanceOpen), instanceOpen, notify: cfg?.membershipNotify !== false }
}

export async function GET() {
  const { error } = await requireInstanceAdmin()
  if (error) return error
  return NextResponse.json(await state())
}

export async function PUT(req: NextRequest) {
  const { error, user } = await requireInstanceAdmin()
  if (error) return error
  const body = await req.json().catch(() => ({})) as { mode?: unknown; notify?: unknown }
  const data: { membershipMode?: string; membershipNotify?: boolean } = {}
  if ('mode' in body) {
    if (typeof body.mode !== 'string' || !(MEMBERSHIP_MODES as readonly string[]).includes(body.mode)) return NextResponse.json({ error: 'mode invalide' }, { status: 400 })
    data.membershipMode = body.mode
  }
  if ('notify' in body) {
    if (typeof body.notify !== 'boolean') return NextResponse.json({ error: 'notify booléen requis' }, { status: 400 })
    data.membershipNotify = body.notify
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Aucun réglage fourni' }, { status: 400 })
  await prisma.configuration.update({ where: { id: 'global' }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: user.id, ip: getClientIp(req), targetType: 'configuration', details: { scope: 'membership-config', ...data },
  })
  return NextResponse.json(await state())
}
