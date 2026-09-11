/**
 * POST /api/admin/siem-config/test — Envoie un événement de test au SIEM configuré
 * pour vérifier la connectivité. Réservé au SUPER_ADMIN. N'écrit pas la config.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/secret-crypto'
import { isValidSiemEndpoint, buildSiemEvent } from '@/lib/siem'
import { deliverSiemEvent, invalidateSiemCache } from '@/lib/siem.server'
import { getClientIp } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = await (prisma as any).siemConfig.findUnique({ where: { id: 'global' } })
  if (!cfg || !isValidSiemEndpoint(cfg.endpoint ?? '')) return NextResponse.json({ error: 'endpoint_invalide' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userEmail = (session.user as any).email ?? undefined
  const event = buildSiemEvent('ADMIN_ACTION', { userEmail, ip: getClientIp(req), details: { test: true, message: 'Événement de test SIEM ACRA' } })
  const res = await deliverSiemEvent(cfg.endpoint, decryptSecret(cfg.authHeader) ?? null, event)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).siemConfig.update({
    where: { id: 'global' },
    data: { lastDeliveryOk: res.ok, lastDeliveryAt: new Date(), lastError: res.ok ? null : (res.error ?? `HTTP ${res.code}`) },
  }).catch(() => {})
  invalidateSiemCache()

  if (!res.ok) return NextResponse.json({ ok: false, error: res.error ?? `HTTP ${res.code}`, code: res.code }, { status: 502 })
  return NextResponse.json({ ok: true, code: res.code })
}
