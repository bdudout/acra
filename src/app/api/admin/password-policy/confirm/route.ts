/**
 * POST /api/admin/password-policy/confirm
 *
 * Confirme manuellement que la configuration MFA est opérationnelle.
 * Annule la fenêtre de confirmation (mfaPendingConfirmation=false).
 * Accessible aux ADMIN uniquement.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  // Politique de mot de passe = réglage d'INSTANCE → SUPER_ADMIN uniquement.
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = await (prisma as any).passwordPolicy.findUnique({ where: { id: 'global' } })

  // Si le MFA n'est pas en attente de confirmation, rien à faire
  if (!current?.mfaPendingConfirmation) {
    return NextResponse.json({ ok: true, alreadyConfirmed: true })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policy = await (prisma as any).passwordPolicy.update({
    where: { id: 'global' },
    data: {
      mfaPendingConfirmation:  false,
      mfaConfirmationDeadline: null,
    },
  })

  const userId   = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ADMIN'
  await auditLog('MFA_CONFIRMED', { userId, userRole, ip: getClientIp(req) })

  return NextResponse.json({ ok: true, policy })
}
