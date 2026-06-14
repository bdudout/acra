/**
 * email.ts — Envoi d'e-mails via le serveur SMTP configuré dans le panel admin
 * (modèle SMTPConfig, singleton global). Le mot de passe est déchiffré à la
 * volée (chiffré au repos, cf. secret-crypto.ts).
 *
 * Aucun e-mail n'est envoyé si le SMTP est désactivé ou incomplet : sendEmail
 * renvoie alors { ok: false, skipped: true } sans lever d'exception, pour que
 * les flux appelants (réinitialisation de mot de passe, etc.) restent
 * fonctionnels même sans serveur d'e-mail.
 */
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/secret-crypto'

export interface SmtpSettings {
  enabled: boolean
  host: string | null
  port: number
  secure: boolean
  username: string | null
  password: string | null
  fromAddress: string | null
  fromName: string | null
}

export interface SendResult {
  ok: boolean
  /** true si l'envoi a été ignoré (SMTP désactivé/incomplet). */
  skipped?: boolean
  error?: string
  messageId?: string
}

/** Charge la configuration SMTP (mot de passe déchiffré). */
export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = await (prisma as any).sMTPConfig.findUnique({ where: { id: 'global' } })
  if (!c) return null
  return {
    enabled: c.enabled,
    host: c.host,
    port: c.port,
    secure: c.secure,
    username: c.username,
    password: decryptSecret(c.password) ?? null,
    fromAddress: c.fromAddress,
    fromName: c.fromName,
  }
}

/** Le SMTP est-il exploitable (activé + champs minimaux renseignés) ? */
export function isUsable(s: SmtpSettings | null): s is SmtpSettings {
  return !!(s && s.enabled && s.host && s.port && s.fromAddress)
}

function buildTransport(s: SmtpSettings) {
  return nodemailer.createTransport({
    host: s.host!,
    port: s.port,
    secure: s.secure, // true => 465 (SSL/TLS) ; false => STARTTLS
    auth: s.username ? { user: s.username, pass: s.password ?? '' } : undefined,
  })
}

function fromHeader(s: SmtpSettings): string {
  return s.fromName ? `"${s.fromName}" <${s.fromAddress}>` : `${s.fromAddress}`
}

export interface EmailMessage {
  to: string
  subject: string
  text?: string
  html?: string
}

/**
 * Envoie un e-mail via le SMTP configuré. Ne lève jamais : renvoie un SendResult.
 * Si `override` est fourni (test de configuration), on l'utilise au lieu de la
 * config en base — pour tester des réglages avant de les enregistrer.
 */
export async function sendEmail(msg: EmailMessage, override?: SmtpSettings): Promise<SendResult> {
  const settings = override ?? (await getSmtpSettings())
  if (!isUsable(settings)) return { ok: false, skipped: true, error: 'SMTP non configuré ou désactivé' }
  try {
    const info = await buildTransport(settings).sendMail({
      from: fromHeader(settings),
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    })
    return { ok: true, messageId: info.messageId }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Échec de l’envoi' }
  }
}
