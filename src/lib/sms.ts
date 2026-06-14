/**
 * sms.ts — Envoi de SMS via le fournisseur configuré (config sur PasswordPolicy :
 * smsProvider / smsApiKey / smsApiSecret / smsSenderId). Fournisseur de référence :
 * Twilio. Le secret est déchiffré à la lecture (chiffré au repos).
 *
 * sendSms ne lève jamais : il renvoie un SmsResult (repli skipped si non
 * configuré), afin que les flux appelants restent robustes.
 */
import { prisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/secret-crypto'

export interface SmsConfig {
  provider: string
  apiKey: string | null    // Twilio Account SID
  apiSecret: string | null // Twilio Auth Token
  senderId: string | null  // Numéro/expéditeur
}

export interface SmsResult {
  ok: boolean
  skipped?: boolean
  error?: string
}

/** Le SMS est-il exploitable (tous les champs requis renseignés) ? */
export function isSmsUsable(c: SmsConfig | null): c is SmsConfig {
  return !!(c && c.provider && c.apiKey && c.apiSecret && c.senderId)
}

/** Construit la requête HTTP Twilio (pur, testable). */
export function buildTwilioRequest(c: SmsConfig, to: string, body: string) {
  return {
    url: `https://api.twilio.com/2010-04-01/Accounts/${c.apiKey}/Messages.json`,
    authHeader: 'Basic ' + Buffer.from(`${c.apiKey}:${c.apiSecret}`).toString('base64'),
    body: new URLSearchParams({ From: c.senderId!, To: to, Body: body }).toString(),
  }
}

/** Charge la configuration SMS (secret déchiffré) depuis la politique globale. */
export async function getSmsConfig(): Promise<SmsConfig | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = await (prisma as any).passwordPolicy.findUnique({ where: { id: 'global' } })
  if (!p) return null
  return {
    provider: p.smsProvider ?? 'TWILIO',
    apiKey: p.smsApiKey ?? null,
    apiSecret: decryptSecret(p.smsApiSecret) ?? null,
    senderId: p.smsSenderId ?? null,
  }
}

/**
 * Envoie un SMS. Ne lève jamais. `override` permet de tester une config avant
 * de l'enregistrer. Seul Twilio est implémenté pour l'instant.
 */
export async function sendSms(to: string, body: string, override?: SmsConfig): Promise<SmsResult> {
  const config = override ?? (await getSmsConfig())
  if (!isSmsUsable(config)) return { ok: false, skipped: true, error: 'SMS non configuré' }
  if (config.provider !== 'TWILIO') return { ok: false, error: `Fournisseur SMS non supporté : ${config.provider}` }

  const req = buildTwilioRequest(config, to, body)
  try {
    const res = await fetch(req.url, {
      method: 'POST',
      headers: { Authorization: req.authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: req.body,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, error: `Twilio ${res.status}: ${detail.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Échec de l’envoi SMS' }
  }
}
