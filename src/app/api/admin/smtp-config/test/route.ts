/**
 * POST /api/admin/smtp-config/test — Envoie un e-mail de test à l'administrateur
 * connecté en utilisant la configuration SMTP enregistrée. ADMIN uniquement.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })

  const to = (session.user as any).email as string
  if (!to) return NextResponse.json({ error: 'Aucune adresse e-mail sur le compte' }, { status: 400 })

  const result = await sendEmail({
    to,
    subject: 'ACRA — E-mail de test',
    text: 'Cet e-mail confirme que votre configuration SMTP ACRA fonctionne.',
    html: `<div style="font-family:sans-serif;font-size:14px;color:#1f2937">
      <h2 style="color:#4f46e5">ACRA — E-mail de test ✅</h2>
      <p>Cet e-mail confirme que votre configuration SMTP fonctionne correctement.</p>
      <p style="color:#6b7280;font-size:12px">Envoyé depuis le panneau d'administration ACRA.</p>
    </div>`,
  })

  // Enregistre le statut du test (garde-fou MFA e-mail + vérification d'e-mail)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).sMTPConfig.update({
    where: { id: 'global' },
    data: { lastTestOk: result.ok, lastTestAt: new Date() },
  }).catch(() => { /* best-effort */ })

  await auditLog('SMTP_TEST_SENT', {
    userId: (session.user as any).id, userRole: (session.user as any).role,
    ip: getClientIp(req), details: { to, ok: result.ok, error: result.error ?? null },
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.skipped ? 'SMTP désactivé ou incomplet' : result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true, to })
}
