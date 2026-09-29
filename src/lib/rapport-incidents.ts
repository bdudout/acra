/**
 * rapport-incidents.ts — Rapports R-INC-1 (tableau de bord incidents) et R-PER-2
 * (pertes). Module PUR : les lignes d'incident arrivent avec leur vue L1 (horloges,
 * totaux convertis, seuils) ; la sortie est un contenu structuré figé par l'édition.
 * Les libellés statiques sont des clés i18n (`{ k }`), ceux des données passent par `labels`.
 */

import { dansPeriode, type Bloc, type Cellule, type Periode, type RapportContenu, type RapportSection } from './rapport-model'
import type { IncidentVue } from './incident-vue'
import type { IncidentsConfig } from './incidents-config'
import { allouer, sanitizeAllocations } from './incident-l1b'

export interface IncidentRapportRow {
  id: string; intitule: string; statut: string; typeEvenement: string | null; taxonomieCode: string | null; entite: string | null
  dateSurvenance: Date | null; dateDetection: Date | null; createdAt: Date; clotureLe: Date | null; quasiIncident: boolean
  l1: IncidentVue
  /** Allocation de la perte entre entités (lot L1 suite) ; absente = tout sur `entite`. */
  allocations?: unknown
}
export interface LabelsRapport {
  statut: (code: string) => string
  typeEvenement: (code: string) => string
  typePerte: (code: string) => string
  taxo: (code: string | null) => string
}

const J = 86_400_000
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100
const refDate = (r: IncidentRapportRow) => r.dateSurvenance ?? r.createdAt
const mois = (d: Date) => d.toISOString().slice(0, 7)
const STATUTS_ORDRE = ['DECLARE', 'QUALIFIE', 'CLOTURE', 'REJETE']

function compter<T>(items: T[], cle: (x: T) => string): [string, number][] {
  const m = new Map<string, number>()
  for (const i of items) m.set(cle(i), (m.get(cle(i)) ?? 0) + 1)
  return [...m.entries()]
}
const tab = (colonnes: string[], lignes: Cellule[][]): Bloc => ({ type: 'tableau', colonnes, lignes })
const cols = (...ks: string[]) => ks.map(k => `rapports.cols.${k}`)

/** R-INC-1 : volumes, délais, tendances et notifications en retard sur la période. */
export function buildRapportIncidents(rows: IncidentRapportRow[], cfg: IncidentsConfig, periode: Periode, now: Date, labels: LabelsRapport): RapportContenu {
  const inc = rows.filter(r => dansPeriode(refDate(r), periode))
  const delais = inc.filter(r => r.dateSurvenance && r.dateDetection).map(r => (r.dateDetection!.getTime() - r.dateSurvenance!.getTime()) / J)
  const clot = inc.filter(r => r.clotureLe).map(r => (r.clotureLe!.getTime() - r.createdAt.getTime()) / J)
  const moy = (a: number[]) => (a.length ? r1(a.reduce((s, x) => s + x, 0) / a.length) : 0)
  const enRetard = inc.reduce((n, r) => n + r.l1.nbEnRetard, 0)

  const parStatut = compter(inc, r => r.statut).sort((a, b) => b[1] - a[1] || STATUTS_ORDRE.indexOf(a[0]) - STATUTS_ORDRE.indexOf(b[0]))
  const parType = compter(inc, r => r.typeEvenement ?? '').sort((a, b) => b[1] - a[1])
  const parMois = compter(inc, r => mois(refDate(r))).sort((a, b) => a[0].localeCompare(b[0]))

  const retards: Cellule[][] = []
  for (const r of inc) for (const h of r.l1.horloges) for (const p of h.phases) {
    if (p.statut === 'EN_RETARD') retards.push([r.intitule, h.label ?? { k: h.labelKey ?? h.regime }, p.label ?? { k: p.labelKey ?? p.code }, p.echeance ? p.echeance.toISOString() : null])
  }
  const anciens = inc.filter(r => r.statut === 'DECLARE' || r.statut === 'QUALIFIE')
    .map(r => ({ r, age: Math.max(0, Math.floor((now.getTime() - refDate(r).getTime()) / J)) })).sort((a, b) => b.age - a.age).slice(0, 5)

  const sections: RapportSection[] = [
    { id: 'synthese', blocs: [{ type: 'kpis', items: [
      { cle: 'total', valeur: inc.length }, { cle: 'ouverts', valeur: inc.filter(r => r.statut === 'DECLARE' || r.statut === 'QUALIFIE').length },
      { cle: 'clotures', valeur: inc.filter(r => r.statut === 'CLOTURE').length }, { cle: 'quasi', valeur: inc.filter(r => r.quasiIncident).length },
      { cle: 'delaiDetectionJours', valeur: moy(delais), unite: 'jours' }, { cle: 'delaiClotureJours', valeur: moy(clot), unite: 'jours' },
      { cle: 'notifsEnRetard', valeur: enRetard, alerte: enRetard > 0 },
    ] }] },
    { id: 'parStatut', blocs: [tab(cols('statut', 'nombre'), parStatut.map(([c, n]) => [labels.statut(c), n]))] },
    { id: 'parType', blocs: [tab(cols('type', 'nombre'), parType.map(([c, n]) => [c ? labels.typeEvenement(c) : { k: 'rapports.nonType' }, n]))] },
    { id: 'parMois', blocs: [tab(cols('mois', 'nombre', 'quasi'), parMois.map(([m, n]) => [m, n, inc.filter(r => mois(refDate(r)) === m && r.quasiIncident).length]))] },
    { id: 'notifsEnRetard', blocs: [tab(cols('incident', 'regime', 'phase', 'echeance'), retards)] },
    { id: 'plusAnciensOuverts', blocs: [tab(cols('incident', 'ageJours'), anciens.map(({ r, age }) => [r.intitule, age]))] },
  ]
  return { code: 'R-INC-1', periode, genereLe: now.toISOString(), deviseReference: cfg.deviseReference, sections }
}

/** R-PER-2 : pertes de la période (quasi-incidents exclus), ventilations et grandes pertes. */
export function buildRapportPertes(rows: IncidentRapportRow[], cfg: IncidentsConfig, periode: Periode, now: Date, labels: LabelsRapport): RapportContenu {
  const inc = rows.filter(r => !r.quasiIncident && dansPeriode(refDate(r), periode))
  const avecPerte = inc.filter(r => r.l1.totaux.brut !== null)
  const somme = (f: (r: IncidentRapportRow) => number | null) => r2(avecPerte.reduce((s, r) => s + (f(r) ?? 0), 0))
  const brut = somme(r => r.l1.totaux.brut); const recup = somme(r => r.l1.totaux.recuperations); const net = somme(r => r.l1.totaux.net)
  const grandes = avecPerte.filter(r => r.l1.seuils.grandePerte)
  const sousSeuil = avecPerte.filter(r => !r.l1.seuils.collectee)
  const devisesSansTaux = [...new Set(avecPerte.flatMap(r => r.l1.totaux.devisesSansTaux))].sort()

  const parType = new Map<string, number>()
  for (const r of avecPerte) for (const [t, m] of Object.entries(r.l1.parType)) parType.set(t, r2((parType.get(t) ?? 0) + m))
  const groupe = (cle: (r: IncidentRapportRow) => string) => {
    const g = new Map<string, { n: number; net: number }>()
    for (const r of avecPerte) { const k = cle(r); const c = g.get(k) ?? { n: 0, net: 0 }; c.n++; c.net = r2(c.net + (r.l1.totaux.net ?? 0)); g.set(k, c) }
    return [...g.entries()].sort((a, b) => b[1].net - a[1].net)
  }
  // Par entité : une perte allouée est répartie (le reliquat revient à l'entité de l'incident) ; le nombre
  // compte les incidents concernés.
  const parEntiteAlloue = (): [string, { n: number; net: number }][] => {
    const g = new Map<string, { ids: Set<string>; net: number }>()
    for (const r of avecPerte) {
      const a = sanitizeAllocations(r.allocations)
      for (const p of allouer(r.l1.totaux.net ?? 0, a.ok ? a.allocations : [], r.entite ?? '')) {
        const c = g.get(p.entite) ?? { ids: new Set<string>(), net: 0 }
        c.ids.add(r.id); c.net = r2(c.net + p.montant); g.set(p.entite, c)
      }
    }
    return [...g.entries()].map(([e, v]): [string, { n: number; net: number }] => [e, { n: v.ids.size, net: v.net }]).sort((a, b) => b[1].net - a[1].net)
  }
  const netMois = new Map<string, number>()
  for (const r of avecPerte) { const m = mois(refDate(r)); netMois.set(m, r2((netMois.get(m) ?? 0) + (r.l1.totaux.net ?? 0))) }

  const sections: RapportSection[] = [
    { id: 'synthese', blocs: [{ type: 'kpis', items: [
      { cle: 'brut', valeur: brut, unite: 'devise' }, { cle: 'recuperations', valeur: recup, unite: 'devise' }, { cle: 'net', valeur: net, unite: 'devise' },
      { cle: 'incidentsAvecPerte', valeur: avecPerte.length }, { cle: 'grandesPertes', valeur: grandes.length, alerte: grandes.length > 0 }, { cle: 'sousSeuil', valeur: sousSeuil.length },
    ] }] },
    { id: 'parTypePerte', blocs: [tab(cols('typePerte', 'montant'), [...parType.entries()].sort((a, b) => b[1] - a[1]).map(([t, m]) => [labels.typePerte(t), m]))] },
    { id: 'parCategorie', blocs: [tab(cols('categorie', 'nombre', 'net'), groupe(r => r.taxonomieCode ?? '').map(([c, v]) => [labels.taxo(c || null), v.n, v.net]))] },
    { id: 'parEntite', blocs: [tab(cols('entite', 'nombre', 'net'), parEntiteAlloue().map(([e, v]) => [e || { k: 'rapports.nonRenseigne' }, v.n, v.net]))] },
    { id: 'grandesPertes', blocs: [tab(cols('incident', 'date', 'net'), grandes.sort((a, b) => (b.l1.totaux.net ?? 0) - (a.l1.totaux.net ?? 0)).slice(0, 10).map(r => [r.intitule, refDate(r).toISOString().slice(0, 10), r.l1.totaux.net]))] },
    { id: 'parMois', blocs: [tab(cols('mois', 'net'), [...netMois.entries()].sort((a, b) => a[0].localeCompare(b[0])))] },
  ]
  if (devisesSansTaux.length) sections.push({ id: 'avertissements', blocs: [{ type: 'texte', cle: 'rapports.avert.devisesSansTaux' }, tab(cols('devise'), devisesSansTaux.map(d => [d]))] })
  return { code: 'R-PER-2', periode, genereLe: now.toISOString(), deviseReference: cfg.deviseReference, sections }
}
