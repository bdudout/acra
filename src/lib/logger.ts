/**
 * Logger structuré ACRA — basé sur Winston.
 * Exécuté côté serveur uniquement (Node.js runtime).
 *
 * Niveaux : error > warn > info > debug
 * En production : JSON structuré (compatible SIEM/ELK/Splunk)
 * En développement : format lisible avec couleurs
 */

import { createLogger, format, transports } from 'winston'
import { mkdirSync } from 'fs'
import { join } from 'path'

const IS_PROD = process.env.NODE_ENV === 'production'

// Répertoire de logs : /tmp/logs en production (accessible par l'user nextjs dans Docker),
// ou ./logs en développement local.
const LOG_DIR = IS_PROD
  ? '/tmp/logs'
  : join(process.cwd(), 'logs')

// Créer le répertoire si nécessaire — best-effort, ne jamais crasher l'app
const fileTransports: InstanceType<typeof transports.File>[] = []
if (IS_PROD) {
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    fileTransports.push(
      new transports.File({ filename: join(LOG_DIR, 'error.log'), level: 'error' }),
      new transports.File({ filename: join(LOG_DIR, 'combined.log') }),
    )
  } catch {
    // Pas de droits sur le FS — log console uniquement (ex: environnement read-only)
    console.warn('[logger] Impossible de créer le répertoire de logs :', LOG_DIR)
  }
}

export const logger = createLogger({
  level: IS_PROD ? 'info' : 'debug',
  defaultMeta: { service: 'acra' },
  format: IS_PROD
    ? format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      )
    : format.combine(
        format.colorize(),
        format.timestamp({ format: 'HH:mm:ss' }),
        format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length && meta.service !== 'acra'
            ? ' ' + JSON.stringify(meta)
            : ''
          return `${timestamp} ${level}: ${message}${metaStr}`
        })
      ),
  transports: [
    new transports.Console(),
    ...fileTransports,
  ],
})

// ── Types d'événements d'audit ────────────────────────────────────────────────

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_RATE_LIMITED'
  | 'LOGIN_LOCKED'
  | 'LOGOUT'
  | 'REGISTER'
  | 'PASSWORD_CHANGED'
  | 'ROLE_CHANGED'
  | 'USER_DELETED'
  | 'USER_CREATED'
  | 'USERS_BULK_IMPORTED'
  | 'USER_SUSPENDED'
  | 'USER_ACTIVATED'
  | 'ANALYSE_CREATED'
  | 'ANALYSE_DELETED'
  | 'ANALYSE_RESTORED'
  | 'ANALYSE_PURGED'
  | 'ANALYSE_APPROVED'
  | 'ANALYSE_REJECTED'
  | 'ANALYSE_SUBMITTED'
  | 'ANALYSE_REVISED'
  | 'RESIDUAL_RISKS_DECISION'
  | 'DEROGATION_REQUESTED'
  | 'DEROGATION_RSSI_OPINION'
  | 'DEROGATION_DOUBLE_REVIEW'
  | 'DEROGATION_VALIDATED'
  | 'DEROGATION_REJECTED'
  | 'DEROGATION_EXTENDED'
  | 'DEROGATION_CLOSED'
  | 'DEROGATION_REVOKED'
  | 'DEROGATION_EXPIRING'
  | 'DEROGATION_EXPIRED'
  | 'DEMO_ORG_PURGED'
  | 'DEMO_ORG_WARNED'
  | 'DEMO_MODE_REFUSED'
  | 'DEMO_CONFIG_UPDATED'
  | 'WORKSHOP_SAVED'
  | 'TIERS_MERGED'
  | 'PASSWORD_POLICY_UPDATED'
  | 'MFA_AUTO_DISABLED'
  | 'MFA_CONFIRMED'
  | 'MFA_CHALLENGE_SENT'
  | 'MFA_VERIFIED'
  | 'EMAIL_VERIFICATION_SENT'
  | 'EMAIL_VERIFIED'
  | 'SSO_CONFIG_UPDATED'
  | 'SMTP_CONFIG_UPDATED'
  | 'SMTP_TEST_SENT'
  | 'ACCESS_GRANTED'
  | 'ACCESS_REVOKED'
  | 'EXPORT'
  | 'ADMIN_ACTION'
  | 'PROFILE_UPDATED'
  | 'SOCLE_TOGGLED'
  | 'ORGANIZATION_CONFIG_UPDATED'
  | 'ORG_CREATED'
  | 'ORG_UPDATED'
  | 'ORG_MEMBER_ADDED'
  | 'ORG_MEMBER_REMOVED'

export interface AuditContext {
  userId?:      string
  userEmail?:   string
  userRole?:    string
  targetId?:    string   // ID de la ressource affectée
  targetType?:  string   // 'user' | 'analyse' | 'policy' | ...
  ip?:          string
  details?:     Record<string, unknown>
}

/**
 * Enregistre un événement d'audit dans les logs ET en base de données.
 */
export async function auditLog(action: AuditAction, ctx: AuditContext = {}) {
  logger.info(`AUDIT:${action}`, {
    audit:     true,
    action,
    userId:    ctx.userId,
    userEmail: ctx.userEmail,
    userRole:  ctx.userRole,
    targetId:  ctx.targetId,
    targetType:ctx.targetType,
    ip:        ctx.ip,
    details:   ctx.details,
  })

  // Persistance en base de données (best-effort — ne bloque pas la requête)
  try {
    const { prisma } = await import('@/lib/prisma')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).auditLog.create({
      data: {
        action,
        userId:     ctx.userId,
        userEmail:  ctx.userEmail,
        userRole:   ctx.userRole,
        targetId:   ctx.targetId,
        targetType: ctx.targetType,
        ip:         ctx.ip,
        details:    ctx.details ? JSON.stringify(ctx.details) : null,
      },
    })
  } catch (err) {
    // Ne jamais faire échouer une requête à cause du logging
    logger.error('auditLog DB write failed', { err })
  }
}

/**
 * Helper : extraire l'IP réelle depuis les headers Next.js (NAT/proxy friendly).
 */
// AUDIT [F003-src] MEDIUM — CWE-290 — Source d'IP non fiable (spoofable)
// CVSS: 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N)
// EVIDENCE: X-Forwarded-For / X-Real-IP sont fournis par le client et falsifiables.
//   Cette fonction est la source des IP du rate-limiting par IP (register) ET de
//   l'audit trail. Conséquences : (1) contournement des limites par IP en faisant
//   varier l'en-tête, (2) empoisonnement des logs d'audit avec de fausses IP.
// FIX: ne faire confiance à XFF que derrière un proxy de confiance ; prendre le
//   dernier hop fiable (et non le 1er élément, falsifiable) ou l'IP exposée par l'infra.
export function getClientIp(req: { headers: { get: (k: string) => string | null } }): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
