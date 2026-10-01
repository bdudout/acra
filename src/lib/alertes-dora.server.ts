// ─── Alertes DORA : collecte et envoi (toutes les heures) ────────────────────
// Incidents des organisations où les modules Incidents et Réglementaire sont actifs : échéances de
// déclaration calculées par `evaluerReportingIncident` (mêmes règles que l'écran), alertes dues
// selon `alertesDoraDues`, un e-mail urgent par personne (RSSI et gestionnaires des risques de
// l'organisation, administrateurs à défaut). Marqueur par incident : `alertesDora`.
import { prisma } from './prisma'
import { getOrgConfig } from './org-config.server'
import { evaluerReportingIncident } from './dora-reporting'
import { alertesDoraDues } from './alertes-dora'
import { sendEmail } from './email'
import { alertesDoraEmail, type AlerteDoraItem } from './email-i18n'
import { appUrl } from './org-invitation.server'
import { auditLog } from './logger'
import type { DoraCriteres } from './dora'

export async function envoyerAlertesDora(now: Date = new Date()) {
  const incidents = await prisma.incident.findMany({
    where: { statut: { not: 'REJETE' }, doraFinaleSoumiseLe: null },
    select: {
      id: true, organizationId: true, intitule: true, dateDetection: true, doraCriteres: true, doraClasseMajeurLe: true,
      doraInitialeSoumiseLe: true, doraIntermediaireSoumiseLe: true, doraFinaleSoumiseLe: true, alertesDora: true,
      organization: { select: { nom: true } },
    },
    take: 10000,
  })
  const actif = new Map<string, boolean>()
  const boite = new Map<string, { email: string; locale: string | null; items: AlerteDoraItem[] }>()
  let alertes = 0
  for (const i of incidents) {
    if (!actif.has(i.organizationId)) { const c = await getOrgConfig(i.organizationId); actif.set(i.organizationId, !!c.incidentsActive && !!c.reglementaireActive) }
    if (!actif.get(i.organizationId)) continue
    const reporting = evaluerReportingIncident({ ...i, doraCriteres: i.doraCriteres as DoraCriteres }, now)
    if (reporting.classe !== 'MAJEUR') continue
    const dues = alertesDoraDues(reporting.echeances, i.alertesDora, now)
    if (!dues.length) continue
    const membres = await prisma.orgMembership.findMany({ where: { organizationId: i.organizationId, role: { in: ['RSSI', 'RISK_MANAGER', 'ADMIN'] } }, select: { role: true, user: { select: { email: true, isActive: true, locale: true } } } })
    const principaux = membres.filter(m => m.role !== 'ADMIN')
    const dests = (principaux.length ? principaux : membres).filter(m => m.user.isActive && m.user.email)
    for (const m of dests) {
      const cle = m.user.email.toLowerCase()
      const e = boite.get(cle) ?? { email: m.user.email, locale: m.user.locale, items: [] }
      for (const a of dues) e.items.push({ organisation: i.organization.nom, incident: i.intitule, phase: a.phase, statut: a.statut, echeance: a.echeance })
      boite.set(cle, e)
    }
    const deja = i.alertesDora && typeof i.alertesDora === 'object' && !Array.isArray(i.alertesDora) ? (i.alertesDora as Record<string, string>) : {}
    await prisma.incident.update({ where: { id: i.id }, data: { alertesDora: { ...deja, ...Object.fromEntries(dues.map(a => [a.cle, now.toISOString()])) } } })
    await auditLog('ORGANIZATION_CONFIG_UPDATED', { organizationId: i.organizationId, details: { scope: 'dora', action: 'alerte', incidentId: i.id, alertes: dues.map(a => a.cle), destinataires: dests.length } })
    alertes += dues.length
  }
  let emailsSent = 0, emailsSkipped = 0
  for (const { email, locale, items } of boite.values()) {
    const tries = [...items].sort((a, b) => a.echeance.getTime() - b.echeance.getTime())
    const mail = alertesDoraEmail(locale, { items: tries, url: appUrl('/incidents') })
    const res = await sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html })
    if (res.ok) emailsSent++; else emailsSkipped++
  }
  return { checked: incidents.length, alertes, emailsSent, emailsSkipped }
}
