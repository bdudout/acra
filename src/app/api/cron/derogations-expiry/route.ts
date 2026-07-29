import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { needsExpiryAlert, joursAvantExpiration, type DerogationStatut } from '@/lib/derogation'
import { sendEmail } from '@/lib/email'
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
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron désactivé (CRON_SECRET absent)' }, { status: 503 })
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.nextUrl.searchParams.get('token') ?? ''
  if (token !== secret) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

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
  const recipientsCache = new Map<string, string[]>()
  const govEmailsFor = async (orgId: string): Promise<string[]> => {
    if (!recipientsCache.has(orgId)) {
      const rows = await prisma.orgMembership.findMany({
        where: { organizationId: orgId, role: { in: [...RECIPIENT_ROLES] } },
        select: { user: { select: { email: true, isActive: true } } },
      })
      recipientsCache.set(orgId, rows.filter(r => r.user.isActive && r.user.email).map(r => r.user.email))
    }
    return recipientsCache.get(orgId)!
  }

  let alerted = 0, emailsSent = 0, emailsSkipped = 0
  for (const d of candidates) {
    const alerteJours = await alerteJoursFor(d.organizationId)
    if (!needsExpiryAlert({ statut: d.statut as DerogationStatut, dateFin: d.dateFin }, alerteJours, now)) continue

    const demandeur = await prisma.user.findUnique({ where: { id: d.demandeurId }, select: { email: true, isActive: true } })
    const emails = new Set<string>(await govEmailsFor(d.organizationId))
    if (demandeur?.isActive && demandeur.email) emails.add(demandeur.email)

    const jours = joursAvantExpiration(d.dateFin ?? null, now)
    const quand = jours < 0 ? `expirée depuis ${-jours} j` : `expire dans ${jours} j`
    for (const to of emails) {
      const res = await sendEmail({
        to,
        subject: `[ACRA] Dérogation « ${d.intitule} » — ${quand}`,
        text: `La dérogation « ${d.intitule} » ${quand}.\nMerci de prolonger, clôturer ou traiter cette dérogation dans ACRA.`,
      })
      if (res.ok) emailsSent++; else emailsSkipped++
    }

    await prisma.derogation.update({ where: { id: d.id }, data: { alerteeLe: now } })
    await auditLog('DEROGATION_EXPIRING', { organizationId: d.organizationId, details: { derogationId: d.id, jours, recipients: emails.size } })
    alerted++
  }

  return NextResponse.json({ ok: true, checked: candidates.length, alerted, emailsSent, emailsSkipped })
}
