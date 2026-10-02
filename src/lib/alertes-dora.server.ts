// ─── Alertes DORA : collecte et envoi (toutes les heures) ────────────────────
// Incidents des organisations où les modules Incidents et Réglementaire sont actifs : échéances de
// déclaration calculées par `evaluerReportingIncident` (mêmes règles que l'écran), alertes dues
// selon `alertesDoraDues`, un e-mail urgent par personne (RSSI et gestionnaires des risques de
// l'organisation, administrateurs à défaut). Marqueur par incident : `alertesDora`.
import { prisma } from './prisma'
import { getOrgConfig } from './org-config.server'
import { evaluerReportingIncident } from './dora-reporting'
import { alertesDoraDues } from './alertes-dora'
import { alertesRegimesDues } from './alertes-notifications'
import { calculerHorloges, sanitizeAttributs, sanitizeNotifications } from './notification-regimes'
import { resolveIncidentsConfig } from './incidents-config'
import { sendEmail } from './email'
import { alertesDoraEmail, type AlerteDoraItem } from './email-i18n'
import { appUrl } from './org-invitation.server'
import { auditLog } from './logger'
import type { DoraCriteres } from './dora'

export async function envoyerAlertesDora(now: Date = new Date()) {
  // DORA : tant que le rapport final n'est pas soumis ; autres régimes : incidents des 120 derniers jours (HIPAA : 60 jours + marge).
  const incidents = await prisma.incident.findMany({
    where: { statut: { not: 'REJETE' }, OR: [{ doraFinaleSoumiseLe: null }, { createdAt: { gte: new Date(now.getTime() - 120 * 24 * 3_600_000) } }] },
    select: {
      id: true, organizationId: true, intitule: true, dateDetection: true, doraCriteres: true, doraClasseMajeurLe: true,
      doraInitialeSoumiseLe: true, doraIntermediaireSoumiseLe: true, doraFinaleSoumiseLe: true, alertesDora: true, attributs: true, notifications: true,
      organization: { select: { nom: true } },
    },
    take: 10000,
  })
  const actif = new Map<string, boolean>(); const doraOrg = new Map<string, boolean>()
  const regimesOrg = new Map<string, ReturnType<typeof resolveIncidentsConfig>['regimes']>()
  const boite = new Map<string, { email: string; locale: string | null; items: AlerteDoraItem[] }>()
  let alertes = 0
  for (const i of incidents) {
    if (!actif.has(i.organizationId)) {
      const c = await getOrgConfig(i.organizationId)
      actif.set(i.organizationId, !!c.incidentsActive)
      regimesOrg.set(i.organizationId, resolveIncidentsConfig(c.incidentsConfig).regimes)
      doraOrg.set(i.organizationId, !!c.reglementaireActive)
    }
    if (!actif.get(i.organizationId)) continue
    // DORA (module Réglementaire) : moteur dédié, incidents majeurs seulement.
    const reporting = doraOrg.get(i.organizationId) ? evaluerReportingIncident({ ...i, doraCriteres: i.doraCriteres as DoraCriteres }, now) : null
    const doraDues = reporting && reporting.classe === 'MAJEUR' && !i.doraFinaleSoumiseLe ? alertesDoraDues(reporting.echeances, i.alertesDora, now) : []
    // Autres régimes de notification activés (NIS2, CRA, RGPD, SEC…) : une relance par phase à faire.
    const horloges = calculerHorloges({ connaissance: i.dateDetection, attributs: sanitizeAttributs(i.attributs), notifications: sanitizeNotifications(i.notifications) }, regimesOrg.get(i.organizationId) ?? [], now)
    const regDues = alertesRegimesDues(horloges, i.alertesDora, now)
    const dues = [...doraDues, ...regDues]
    if (!dues.length) continue
    const membres = await prisma.orgMembership.findMany({ where: { organizationId: i.organizationId, role: { in: ['RSSI', 'RISK_MANAGER', 'ADMIN'] } }, select: { role: true, user: { select: { email: true, isActive: true, locale: true } } } })
    const principaux = membres.filter(m => m.role !== 'ADMIN')
    const dests = (principaux.length ? principaux : membres).filter(m => m.user.isActive && m.user.email)
    for (const m of dests) {
      const cle = m.user.email.toLowerCase()
      const e = boite.get(cle) ?? { email: m.user.email, locale: m.user.locale, items: [] }
      for (const a of dues) e.items.push('regime' in a
        ? { organisation: i.organization.nom, incident: i.intitule, statut: a.statut, echeance: a.echeance, phaseCode: a.phase, regimeLabelKey: a.regimeLabelKey, regimeLabel: a.regimeLabel ?? a.regime, phaseLabelKey: a.phaseLabelKey, phaseLabel: a.phaseLabel }
        : { organisation: i.organization.nom, incident: i.intitule, phase: a.phase, statut: a.statut, echeance: a.echeance })
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
