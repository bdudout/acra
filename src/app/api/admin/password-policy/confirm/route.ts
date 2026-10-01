/**
 * POST /api/admin/password-policy/confirm
 *
 * Confirme manuellement que la configuration MFA est opérationnelle.
 * Annule la fenêtre de confirmation (mfaPendingConfirmation=false).
 * Accessible aux ADMIN uniquement.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { requireInstanceAdmin } from '@/lib/route-guard.server'

// POST /api/admin/password-policy/confirm — confirme un changement de politique de mot de passe en attente (MFA) — SUPER_ADMIN.
export async function POST(req: NextRequest) {
  // Réglage d'INSTANCE → SUPER_ADMIN (garde commune, lib/route-guard.server.ts).
  const guard = await requireInstanceAdmin()
  if (guard.error) return guard.error
  const session = guard.session

  const current = await prisma.passwordPolicy.findUnique({ where: { id: 'global' } })

  // Si le MFA n'est pas en attente de confirmation, rien à faire
  if (!current?.mfaPendingConfirmation) {
    return NextResponse.json({ ok: true, alreadyConfirmed: true })
  }

  const policy = await prisma.passwordPolicy.update({
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
