import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { needsExpiryAlert, joursAvantExpiration, type DerogationStatut } from '@/lib/derogation'
import { sendEmail } from '@/lib/email'
import { derogationExpiryEmail } from '@/lib/email-i18n'
import { auditLog } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Rôles destinataires des alertes (gouvernance de l'organisation).
const RECIPIENT_ROLES = ['RSSI', 'ADMIN', 'RISK_MANAGER'] as const

/**
 * POST /api/cron/derogations-expiry — ALERTE INDIVIDUELLE d'expiration.
 *
 * À appeler par un planificateur externe avec `Authorization: Bearer <CRON_SECRET>`.
 * Pour chaque dérogation ACTIVE jamais encore alertée entrant dans la fenêtre
 * d'alerte (OrganizationConfig.derogationAlerteJours, défaut 30 j) : notifie le
 * demandeur et la gouvernance de l'organisation, marque `alerteeLe` (anti-doublon)
 * et journalise DEROGATION_EXPIRING. Idempotent (une alerte par dérogation).
 *
 * 503 si CRON_SECRET absent ; 401 si le secret ne correspond pas.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied

  const now = new Date()
  const candidates = await prisma.derogation.findMany({
    where: { statut: 'ACTIVE', alerteeLe: null },
    select: { id: true, organizationId: true, intitule: true, statut: true, dateFin: true, demandeurId: true },
  })

  const cfgCache = new Map<string, number>()
  const alerteJoursFor = async (orgId: string): Promise<number> => {
    if (!cfgCache.has(orgId)) cfgCache.set(orgId, (await getOrgConfig(orgId)).derogationAlerteJours ?? 30)
    return cfgCache.get(orgId)!
  }
  type Recipient = { email: string; locale: string | null }
  const recipientsCache = new Map<string, Recipient[]>()
  const govRecipientsFor = async (orgId: string): Promise<Recipient[]> => {
    if (!recipientsCache.has(orgId)) {
      const rows = await prisma.orgMembership.findMany({
        where: { organizationId: orgId, role: { in: [...RECIPIENT_ROLES] } },
        select: { user: { select: { email: true, isActive: true, locale: true } } },
      })
      recipientsCache.set(orgId, rows.filter(r => r.user.isActive && r.user.email).map(r => ({ email: r.user.email, locale: r.user.locale })))
    }
    return recipientsCache.get(orgId)!
  }

  let alerted = 0, emailsSent = 0, emailsSkipped = 0
  for (const d of candidates) {
    const alerteJours = await alerteJoursFor(d.organizationId)
    if (!needsExpiryAlert({ statut: d.statut as DerogationStatut, dateFin: d.dateFin }, alerteJours, now)) continue

    const demandeur = await prisma.user.findUnique({ where: { id: d.demandeurId }, select: { email: true, isActive: true, locale: true } })
    // Déduplication par e-mail (la langue du 1er trouvé prime).
    const byEmail = new Map<string, Recipient>()
    for (const r of await govRecipientsFor(d.organizationId)) if (!byEmail.has(r.email)) byEmail.set(r.email, r)
    if (demandeur?.isActive && demandeur.email && !byEmail.has(demandeur.email)) byEmail.set(demandeur.email, { email: demandeur.email, locale: demandeur.locale })

    const jours = joursAvantExpiration(d.dateFin ?? null, now)
    for (const r of byEmail.values()) {
      const { subject, text, html } = derogationExpiryEmail(r.locale, { intitule: d.intitule, jours })
      const res = await sendEmail({ to: r.email, subject, text, html })
      if (res.ok) emailsSent++; else emailsSkipped++
    }
    await prisma.derogation.update({ where: { id: d.id }, data: { alerteeLe: now } })
    await auditLog('DEROGATION_EXPIRING', { organizationId: d.organizationId, details: { derogationId: d.id, jours, recipients: byEmail.size } })
    alerted++
  }

  return NextResponse.json({ ok: true, checked: candidates.length, alerted, emailsSent, emailsSkipped })
}
