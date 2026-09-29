// ─── Génération du contenu d'un rapport (lot L2) ─────────────────────────────
// Charge les données de l'organisation, applique les builders purs et renvoie le
// contenu structuré à figer dans une édition. Les libellés issus des données
// (catégories, types) sont résolus dans la langue demandée à la génération.

import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n'
import { resolveTaxonomie, taxonomieLabel } from '@/lib/taxonomie'
import { resolveIncidentsConfig } from '@/lib/incidents-config'
import { vueIncidentL1 } from '@/lib/incident-vue'
import { buildRapportIncidents, buildRapportPertes, type IncidentRapportRow, type LabelsRapport } from '@/lib/rapport-incidents'
import { buildRapportDirection } from '@/lib/rapport-direction'
import { buildRapportPlanControle, buildRapportEfficacite, buildRapportAnomalies, type ControleRapportRow } from '@/lib/rapport-controles'
import { sanitizeConception } from '@/lib/controle-l3'
import { dansPeriode, type Periode, type RapportCode, type RapportContenu } from '@/lib/rapport-model'
import { gatherGrcConsolide } from '@/lib/grc-consolide.server'
import type { OrgConfigResolved } from '@/lib/org-config'

const MAX_INCIDENTS = 5000

async function chargerIncidents(orgId: string, cfg: OrgConfigResolved, now: Date): Promise<{ rows: IncidentRapportRow[]; incidentsCfg: ReturnType<typeof resolveIncidentsConfig> }> {
  const incidentsCfg = resolveIncidentsConfig(cfg.incidentsConfig)
  const raw = await prisma.incident.findMany({
    where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: MAX_INCIDENTS,
    select: {
      id: true, intitule: true, statut: true, typeEvenement: true, taxonomieCode: true, entite: true, dateSurvenance: true, dateDetection: true,
      createdAt: true, clotureLe: true, quasiIncident: true, attributs: true, notifications: true, pertes: true, recuperationsLignes: true,
    },
  })
  return { incidentsCfg, rows: raw.map(r => ({ ...r, l1: vueIncidentL1(r, incidentsCfg, now) })) }
}

async function chargerControles(orgId: string): Promise<ControleRapportRow[]> {
  const raw = await prisma.controle.findMany({
    where: { organizationId: orgId }, orderBy: { createdAt: 'asc' }, take: 2000,
    select: {
      id: true, intitule: true, niveau: true, responsable: true, actif: true, cle: true, modeControle: true, typeControle: true, periodicite: true, createdAt: true, conception: true,
      executions: { select: { resultat: true, dateRealisation: true }, orderBy: { dateRealisation: 'desc' }, take: 400 },
    },
  })
  return raw.map(({ createdAt, conception, ...c }) => ({ ...c, creeLe: createdAt, conception: sanitizeConception(conception) }))
}

export async function genererContenuRapport(code: RapportCode, orgId: string, cfg: OrgConfigResolved, periode: Periode, locale: string, now: Date): Promise<RapportContenu> {
  const t = getT(locale)
  const tr = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string ?? key
  // Rapports du contrôle permanent (L3) : pas besoin des incidents.
  if (code === 'R-CTL-1' || code === 'R-CTL-2' || code === 'R-CTL-3') {
    const controles = await chargerControles(orgId)
    return code === 'R-CTL-1' ? buildRapportPlanControle(controles, periode, now) : code === 'R-CTL-2' ? buildRapportEfficacite(controles, periode, now) : buildRapportAnomalies(controles, periode, now)
  }
  const { rows, incidentsCfg } = await chargerIncidents(orgId, cfg, now)
  const taxonomie = resolveTaxonomie(cfg.taxonomieRisques)
  const labels: LabelsRapport = {
    statut: c => (t.incidents.statuts as Record<string, string>)[c] ?? c,
    typeEvenement: c => { const x = incidentsCfg.typesEvenement.find(y => y.code === c); return x?.label ?? (x?.labelKey ? tr(x.labelKey) : c) },
    typePerte: c => { const x = incidentsCfg.typesPerte.find(y => y.code === c); return x?.label ?? (x?.labelKey ? tr(x.labelKey) : c) },
    taxo: c => { if (!c) return '—'; const n = taxonomie.find(x => x.code === c); return n ? taxonomieLabel(n, tr) : c },
  }
  if (code === 'R-INC-1') return buildRapportIncidents(rows, incidentsCfg, periode, now, labels)
  if (code === 'R-PER-2') return buildRapportPertes(rows, incidentsCfg, periode, now, labels)

  // R-GRC-3 : consolidé GRC + incidents de la période.
  const { consolide, modules } = await gatherGrcConsolide(orgId, cfg, now)
  const inc = rows.filter(r => dansPeriode(r.dateSurvenance ?? r.createdAt, periode))
  const avecPerte = inc.filter(r => !r.quasiIncident && r.l1.totaux.net !== null)
  return buildRapportDirection({
    consolide, modules, deviseReference: incidentsCfg.deviseReference, periode, now,
    incidents: cfg.incidentsActive ? {
      ouverts: inc.filter(r => r.statut === 'DECLARE' || r.statut === 'QUALIFIE').length,
      perteNettePeriode: Math.round(avecPerte.reduce((s, r) => s + (r.l1.totaux.net ?? 0), 0) * 100) / 100,
      notifsEnRetard: inc.reduce((n, r) => n + r.l1.nbEnRetard, 0),
      grandesPertes: avecPerte.filter(r => r.l1.seuils.grandePerte).length,
    } : undefined,
  })
}
