// ─── Page « À traiter » : déclarations d'incident à effectuer ─────────────────
// Pour les organisations où la personne est RSSI ou gestionnaire des risques (administrateur seulement si l'organisation
// n'en a pas) — mêmes destinataires que l'alerte urgente (lib/alertes-dora.server) — et dont le module Incidents est actif :
// toutes les phases NON SOUMISES à faire ou en retard (DORA pour un incident majeur si le module Réglementaire est actif ;
// autres régimes activés : NIS2, RGPD, CRA…), sans tenir compte des alertes déjà envoyées. Lecture seule.
import { prisma } from './prisma'
import { getOrgConfig } from './org-config.server'
import { evaluerReportingIncident } from './dora-reporting'
import { calculerHorloges, sanitizeAttributs, sanitizeNotifications } from './notification-regimes'
import { resolveIncidentsConfig } from './incidents-config'
import type { AlerteDoraItem } from './email-i18n'
import type { DoraCriteres } from './dora'

export type DeclarationATraiter = AlerteDoraItem & { organisationId: string; incidentId: string }
const H = 3_600_000

export async function declarationsATraiter(userId: string, now: Date = new Date()): Promise<DeclarationATraiter[]> {
  const memberships = await prisma.orgMembership.findMany({ where: { userId, role: { in: ['RSSI', 'RISK_MANAGER', 'ADMIN'] } }, select: { organizationId: true, role: true } })
  const orgIds: string[] = []
  const regimesOrg = new Map<string, ReturnType<typeof resolveIncidentsConfig>['regimes']>()
  const doraOrg = new Map<string, boolean>()
  for (const ms of memberships) {
    if (orgIds.includes(ms.organizationId)) continue
    if (ms.role === 'ADMIN') {
      // Administrateur : destinataire seulement si l'organisation n'a ni RSSI ni gestionnaire des risques.
      const principaux = await prisma.orgMembership.findMany({ where: { organizationId: ms.organizationId, role: { in: ['RSSI', 'RISK_MANAGER'] } }, select: { role: true }, take: 1 })
      if (principaux.length) continue
    }
    const c = await getOrgConfig(ms.organizationId)
    if (!c.incidentsActive) continue
    orgIds.push(ms.organizationId)
    regimesOrg.set(ms.organizationId, resolveIncidentsConfig(c.incidentsConfig).regimes)
    doraOrg.set(ms.organizationId, !!c.reglementaireActive)
  }
  if (!orgIds.length) return []
  const incidents = await prisma.incident.findMany({
    where: { organizationId: { in: orgIds }, statut: { not: 'REJETE' }, OR: [{ doraFinaleSoumiseLe: null }, { createdAt: { gte: new Date(now.getTime() - 120 * 24 * H) } }] },
    select: {
      id: true, organizationId: true, intitule: true, dateDetection: true, doraCriteres: true, doraClasseMajeurLe: true,
      doraInitialeSoumiseLe: true, doraIntermediaireSoumiseLe: true, doraFinaleSoumiseLe: true, attributs: true, notifications: true,
      organization: { select: { nom: true } },
    },
    take: 2000,
  })
  const out: DeclarationATraiter[] = []
  for (const i of incidents) {
    const base = { organisationId: i.organizationId, incidentId: i.id, organisation: i.organization.nom, incident: i.intitule }
    if (doraOrg.get(i.organizationId)) {
      const r = evaluerReportingIncident({ ...i, doraCriteres: i.doraCriteres as DoraCriteres }, now)
      if (r.classe === 'MAJEUR' && !i.doraFinaleSoumiseLe) {
        for (const e of r.echeances) if (e.echeance && (e.statut === 'A_FAIRE' || e.statut === 'EN_RETARD')) out.push({ ...base, phase: e.phase, statut: e.statut, echeance: e.echeance })
      }
    }
    const horloges = calculerHorloges({ connaissance: i.dateDetection, attributs: sanitizeAttributs(i.attributs), notifications: sanitizeNotifications(i.notifications) }, regimesOrg.get(i.organizationId) ?? [], now)
    for (const h of horloges) for (const p of h.phases) {
      if (!p.echeance || (p.statut !== 'A_FAIRE' && p.statut !== 'EN_RETARD')) continue
      out.push({ ...base, statut: p.statut, echeance: p.echeance, phaseCode: p.code, regimeLabelKey: h.labelKey, regimeLabel: h.label ?? h.regime, phaseLabelKey: p.labelKey, phaseLabel: p.label })
    }
  }
  return out.sort((a, b) => a.echeance.getTime() - b.echeance.getTime())
}
