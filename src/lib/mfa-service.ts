/**
 * mfa-service.ts — Couche d'orchestration MFA (DB + envoi). Crée un challenge
 * OTP, l'envoie par le canal demandé (SMS/e-mail) et le vérifie. S'appuie sur
 * les primitives pures de `mfa.ts`, l'envoi `sms.ts` / `email.ts`.
 *
 * NB : non encore branché sur le flux d'authentification (`authorize`). C'est la
 * brique appelée lors de l'intégration du challenge MFA au login.
 */
import { prisma } from '@/lib/prisma'
import { generateCode, hashCode, verifyCode, isExpired, MFA_TTL_MS, MFA_MAX_ATTEMPTS } from '@/lib/mfa'
import { sendSms } from '@/lib/sms'
import { sendEmail } from '@/lib/email'

export type MfaChannel = 'SMS' | 'EMAIL'

function secret(): string {
  return process.env.SECRETS_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'dev-mfa-secret'
}

/** Masque une destination pour l'affichage : a***@ex.com / +33•••••89. */
export function maskDestination(channel: MfaChannel, dest: string): string {
  if (channel === 'EMAIL') {
    const [u, d] = dest.split('@')
    if (!d) return '***'
    return `${u.slice(0, 1)}***@${d}`
  }
  const tail = dest.slice(-2)
  return `${dest.slice(0, 3)}•••••${tail}`
}

export interface CreateChallengeResult {
  ok: boolean
  masked?: string
  error?: string
}

/**
 * Génère un code, l'envoie via le canal demandé et persiste le challenge
 * (les challenges non consommés précédents sont invalidés). `destination` =
 * numéro (SMS) ou e-mail (EMAIL).
 */
export async function createAndSendChallenge(opts: {
  userId: string
  channel: MfaChannel
  destination: string
  appName?: string
}): Promise<CreateChallengeResult> {
  const { userId, channel, destination, appName = 'ACRA' } = opts
  if (!destination) return { ok: false, error: 'Destination manquante' }

  const code = generateCode()
  const codeHash = hashCode(code, secret())
  const expiresAt = new Date(Date.now() + MFA_TTL_MS)

  // Envoi avant persistance : si l'envoi échoue, pas de challenge orphelin.
  const text = `${appName} — Votre code de vérification : ${code} (valable 5 minutes).`
  const sent = channel === 'SMS'
    ? await sendSms(destination, text)
    : await sendEmail({
        to: destination,
        subject: `${appName} — Code de vérification`,
        text,
        html: `<div style="font-family:sans-serif;font-size:14px;color:#1f2937">
          <h2 style="color:#4f46e5">Code de vérification</h2>
          <p>Votre code : <strong style="font-size:20px;font-family:monospace;letter-spacing:2px">${code}</strong></p>
          <p style="color:#6b7280;font-size:12px">Valable 5 minutes. Ne le partagez avec personne.</p>
        </div>`,
      })

  if (!sent.ok) {
    return { ok: false, error: sent.skipped ? `Canal ${channel} non configuré` : (sent.error ?? 'Échec de l’envoi') }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any
  await p.mfaChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: new Date() } })
  await p.mfaChallenge.create({ data: { userId, codeHash, channel, destination: maskDestination(channel, destination), expiresAt } })

  return { ok: true, masked: maskDestination(channel, destination) }
}

export interface VerifyResult {
  ok: boolean
  error?: 'no_challenge' | 'expired' | 'too_many_attempts' | 'invalid'
  remaining?: number
}

/** Vérifie le code soumis contre le challenge actif le plus récent. */
export async function verifyChallenge(userId: string, code: string): Promise<VerifyResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any
  const ch = await p.mfaChallenge.findFirst({ where: { userId, consumedAt: null }, orderBy: { createdAt: 'desc' } })
  if (!ch) return { ok: false, error: 'no_challenge' }
  if (isExpired(ch.expiresAt)) return { ok: false, error: 'expired' }
  if (ch.attempts >= MFA_MAX_ATTEMPTS) return { ok: false, error: 'too_many_attempts' }

  if (!verifyCode(code, ch.codeHash, secret())) {
    const updated = await p.mfaChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } })
    return { ok: false, error: 'invalid', remaining: Math.max(0, MFA_MAX_ATTEMPTS - updated.attempts) }
  }

  await p.mfaChallenge.update({ where: { id: ch.id }, data: { consumedAt: new Date() } })
  return { ok: true }
}
