import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { buildDerogationDigest, type DigestSource } from '@/lib/derogation'
import { sendEmail } from '@/lib/email'
import { derogationDigestEmail } from '@/lib/email-i18n'

export const dynamic = 'force-dynamic'

const RECIPIENT_ROLES = ['RSSI', 'ADMIN', 'RISK_MANAGER'] as const

/**
 * POST /api/cron/derogations-digest — DIGEST périodique (mensuel) par organisation.
 *
 * À appeler par un planificateur externe avec `Authorization: Bearer <CRON_SECRET>`.
 * Pour chaque organisation ayant au moins une dérogation ACTIVE, construit une
 * synthèse (actives / bientôt expirées / expirées) et l'envoie à la gouvernance.
 * La cadence (mensuelle) est portée par le planificateur : l'endpoint ne fait
 * qu'agréger et envoyer. Aucune donnée métier retournée.
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
  const actives = await prisma.derogation.findMany({
    where: { statut: 'ACTIVE' },
    select: { id: true, organizationId: true, intitule: true, statut: true, dateFin: true },
  })

  // Regroupement par organisation.
  const parOrg = new Map<string, DigestSource[]>()
  for (const d of actives) {
    const arr = parOrg.get(d.organizationId) ?? []
    arr.push({ id: d.id, intitule: d.intitule, statut: d.statut as DigestSource['statut'], dateFin: d.dateFin })
    parOrg.set(d.organizationId, arr)
  }

  let orgsNotified = 0, emailsSent = 0, emailsSkipped = 0
  for (const [orgId, derogs] of parOrg) {
    const cfg = await getOrgConfig(orgId)
    const digest = buildDerogationDigest(derogs, cfg.derogationAlerteJours ?? 30, now)
    // Rien à signaler si aucune dérogation à risque.
    if (digest.expireBientot === 0 && digest.expiree === 0) continue

    const rows = await prisma.orgMembership.findMany({
      where: { organizationId: orgId, role: { in: [...RECIPIENT_ROLES] } },
      select: { user: { select: { email: true, isActive: true, locale: true } } },
    })
    // Déduplication par e-mail (langue du 1er trouvé).
    const byEmail = new Map<string, string | null>()
    for (const r of rows) if (r.user.isActive && r.user.email && !byEmail.has(r.user.email)) byEmail.set(r.user.email, r.user.locale)
    if (byEmail.size === 0) continue

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { nom: true } })
    const orgNom = org?.nom ?? ''
    const items = digest.aRisque.map(x => ({ intitule: x.intitule, joursRestants: x.joursRestants }))

    orgsNotified++
    for (const [to, locale] of byEmail) {
      const { subject, text } = derogationDigestEmail(locale, { orgNom, active: digest.active, expireBientot: digest.expireBientot, expiree: digest.expiree, items })
      const res = await sendEmail({ to, subject, text })
      if (res.ok) emailsSent++; else emailsSkipped++
    }
  }

  return NextResponse.json({ ok: true, orgs: parOrg.size, orgsNotified, emailsSent, emailsSkipped })
}
