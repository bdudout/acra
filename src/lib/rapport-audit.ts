/**
 * rapport-audit.ts — Rapports de l'audit interne (lot L4), modèle des éditions figées :
 *  - R-AUD-1 : plan d'audit pluriannuel et couverture de l'univers ;
 *  - R-AUD-2 : missions et constats de la période (notation, criticité, indépendance) ;
 *  - R-AUD-3 : suivi des recommandations (mise en œuvre, vérification, retards, reports, ancienneté).
 * Module PUR. Libellés statiques = clés i18n (`{ k }`), résolues à l'affichage.
 */

import { planPluriannuel, synthetiserRecommandations, type UniversLite } from './audit-l4'
import { dansPeriode, type Bloc, type Cellule, type Periode, type RapportContenu, type RapportSection } from './rapport-model'

export interface MissionRapport {
  id: string; intitule: string; statut: string; dateDebut: Date | null; dateFin: Date | null; notation: number | null
  independance: unknown; processusIds: string[]; universIds: string[]
}
export interface ConstatRapport {
  id: string; missionId: string; intitule: string; criticite: number | null; statut: string
  echeance: Date | null; echeanceInitiale: Date | null; createdAt: Date; reports: unknown; source: string
}
export interface AuditRapportData { univers: UniversLite[]; missions: MissionRapport[]; constats: ConstatRapport[] }

const cols = (...ks: string[]) => ks.map(k => `rapports.cols.${k}`)
const tab = (colonnes: string[], lignes: Cellule[][]): Bloc => ({ type: 'tableau', colonnes, lignes })
const meta = (code: RapportContenu['code'], periode: Periode, now: Date, sections: RapportSection[]): RapportContenu => ({ code, periode, genereLe: now.toISOString(), deviseReference: 'EUR', sections })
const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const dateMission = (m: MissionRapport) => m.dateFin ?? m.dateDebut
const independanceDeclaree = (m: MissionRapport) => !!(m.independance && typeof m.independance === 'object' && (m.independance as { declareLe?: unknown }).declareLe)
const notationCell = (n: number | null): Cellule => (n ? { k: `rapports.notations.${n}` } : { k: 'rapports.notations.NON_NOTEE' })

/** R-AUD-1 : couverture de l'univers d'audit, plan par année, missions de la période. */
export function buildRapportPlanAudit(data: AuditRapportData, periode: Periode, now: Date): RapportContenu {
  const plan = planPluriannuel(data.univers, data.missions, now, { horizonAns: 3 })
  const parUnivers = new Map(data.univers.map(u => [u.id, u]))
  const attention = plan.entrees.filter(e => e.statut === 'EN_RETARD' || e.statut === 'JAMAIS_AUDITE' || e.statut === 'A_PLANIFIER')
  const mp = data.missions.filter(m => dansPeriode(dateMission(m), periode))
  const s = plan.synthese
  return meta('R-AUD-1', periode, now, [
    { id: 'synthese', blocs: [{ type: 'kpis', items: [
      { cle: 'univers', valeur: s.total }, { cle: 'couverture', valeur: s.couverturePct ?? 0, unite: 'pct' }, { cle: 'enRetard', valeur: s.enRetard, alerte: s.enRetard > 0 },
      { cle: 'jamais', valeur: s.jamais, alerte: s.jamais > 0 }, { cle: 'aPlanifier', valeur: s.aPlanifier }, { cle: 'planifie', valeur: s.planifie },
      { cle: 'missionsPeriode', valeur: mp.length },
    ] }] },
    { id: 'universAttention', blocs: [tab(cols('univers', 'risque', 'derniere', 'prochaine', 'couvertureStatut'), attention.map(e => {
      const u = parUnivers.get(e.universId)!
      return [u.intitule, u.risque, e.derniere, e.prochaine, { k: `rapports.couvertures.${e.statut}` }]
    }))] },
    { id: 'parAnnee', blocs: [tab(cols('annee', 'nombre'), plan.parAnnee.map(a => [a.annee, a.universIds.length]))] },
    { id: 'missions', blocs: [tab(cols('mission', 'statut', 'dateFin'), mp.map(m => [m.intitule, { k: `rapports.missionStatuts.${m.statut}` }, jour(dateMission(m))]))] },
  ])
}

/** R-AUD-2 : missions de la période (statut, notation, constats) et constats émis. */
export function buildRapportMissions(data: AuditRapportData, periode: Periode, now: Date): RapportContenu {
  const mp = data.missions.filter(m => dansPeriode(dateMission(m), periode))
  const constatsPeriode = data.constats.filter(c => dansPeriode(c.createdAt, periode))
  const closes = mp.filter(m => m.statut === 'CLOTUREE')
  const notes = closes.map(m => m.notation).filter((n): n is number => n !== null)
  const nbConstats = (m: MissionRapport) => data.constats.filter(c => c.missionId === m.id).length
  const critiques = constatsPeriode.filter(c => c.criticite === 4)
  const nonDeclarees = mp.filter(m => !independanceDeclaree(m)).length
  return meta('R-AUD-2', periode, now, [
    { id: 'synthese', blocs: [{ type: 'kpis', items: [
      { cle: 'missions', valeur: mp.length }, { cle: 'missionsCloturees', valeur: closes.length },
      { cle: 'notationMoyenne', valeur: notes.length ? Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 10) / 10 : 0 },
      { cle: 'constats', valeur: constatsPeriode.length }, { cle: 'critiques', valeur: critiques.length, alerte: critiques.length > 0 },
      { cle: 'independanceNonDeclaree', valeur: nonDeclarees, alerte: nonDeclarees > 0 },
    ] }] },
    { id: 'missions', blocs: [tab(cols('mission', 'statut', 'notation', 'constats', 'independance'), mp.map(m => [
      m.intitule, { k: `rapports.missionStatuts.${m.statut}` }, notationCell(m.notation), nbConstats(m),
      { k: independanceDeclaree(m) ? ((m.independance as { conflit?: boolean }).conflit ? 'rapports.independances.CONFLIT' : 'rapports.independances.OK') : 'rapports.independances.NON_DECLAREE' }]))] },
    { id: 'constatsCritiques', blocs: [tab(cols('constat', 'criticite', 'statut'), critiques.map(c => [c.intitule, c.criticite, { k: `rapports.constatStatuts.${c.statut}` }]))] },
  ])
}

/** R-AUD-3 : état des recommandations à la date de génération (instantané), indicateurs et plus anciennes. */
export function buildRapportRecommandations(data: AuditRapportData, periode: Periode, now: Date): RapportContenu {
  const s = synthetiserRecommandations(data.constats, now)
  const ouvertes = data.constats.filter(c => c.statut === 'OUVERT' || c.statut === 'EN_COURS')
    .map(c => ({ c, age: Math.max(0, Math.floor((now.getTime() - c.createdAt.getTime()) / 86_400_000)) })).sort((a, b) => b.age - a.age).slice(0, 10)
  const enAttente = data.constats.filter(c => (Array.isArray(c.reports) ? c.reports : []).some((r: { statut?: string }) => r?.statut === 'DEMANDE'))
  return meta('R-AUD-3', periode, now, [
    { id: 'synthese', blocs: [{ type: 'kpis', items: [
      { cle: 'total', valeur: s.total }, { cle: 'ouvertes', valeur: s.ouvertes }, { cle: 'enRetard', valeur: s.enRetard, alerte: s.enRetard > 0 },
      { cle: 'tauxMiseEnOeuvre', valeur: s.tauxMiseEnOeuvre ?? 0, unite: 'pct' }, { cle: 'tauxVerification', valeur: s.tauxVerification ?? 0, unite: 'pct' },
      { cle: 'reportees', valeur: s.reportees }, { cle: 'reportsEnAttente', valeur: s.reportsEnAttente, alerte: s.reportsEnAttente > 0 },
      { cle: 'ancienneteMoyenneJours', valeur: s.ancienneteMoyenneJours, unite: 'jours' },
    ] }] },
    { id: 'plusAnciennes', blocs: [tab(cols('constat', 'criticite', 'statut', 'ageJours', 'echeance'), ouvertes.map(({ c, age }) => [c.intitule, c.criticite, { k: `rapports.constatStatuts.${c.statut}` }, age, jour(c.echeance)]))] },
    { id: 'reportsAttente', blocs: [tab(cols('constat', 'criticite', 'echeance'), enAttente.map(c => [c.intitule, c.criticite, jour(c.echeance)]))] },
    { id: 'parCriticite', blocs: [tab(cols('criticite', 'nombre'), Object.entries(s.parCriticite).sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, n]) => [Number(k), n]))] },
    { id: 'parSource', blocs: [tab(cols('source', 'nombre'), Object.entries(s.parSource).map(([k, n]) => [{ k: `rapports.sources.${k}` }, n]))] },
  ])
}
