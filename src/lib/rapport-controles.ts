/**
 * rapport-controles.ts — Rapports du contrôle permanent (lot L3), modèle des éditions figées :
 *  - R-CTL-1 : avancement du plan de contrôle (prévu / réalisé / en retard, par mois et niveau) ;
 *  - R-CTL-2 : efficacité du dispositif (conception × efficacité opérationnelle, contrôles clés) ;
 *  - R-CTL-3 : anomalies récurrentes et escalade.
 * Module PUR. Libellés statiques = clés i18n (`{ k }`), résolues à l'affichage.
 */

import { evaluerEfficacite } from './controle'
import { planAnnuel, fluxInterrompu, appreciationControle, analyseRecurrence, escaladeAnomalie, sanitizeConception, type Conception } from './controle-l3'
import { dansPeriode, type Bloc, type Cellule, type Periode, type RapportContenu, type RapportSection } from './rapport-model'

export interface ControleRapportRow {
  id: string; intitule: string; niveau: string; responsable: string | null; actif: boolean; cle: boolean
  modeControle: string; typeControle: string | null; periodicite: string; creeLe: Date
  conception: Conception | { statut: string } | null
  executions: { resultat: string; dateRealisation: Date }[]
}

const cols = (...ks: string[]) => ks.map(k => `rapports.cols.${k}`)
const tab = (colonnes: string[], lignes: Cellule[][]): Bloc => ({ type: 'tableau', colonnes, lignes })
const meta = (code: RapportContenu['code'], periode: Periode, now: Date, sections: RapportSection[]): RapportContenu =>
  ({ code, periode, genereLe: now.toISOString(), deviseReference: 'EUR', sections })
const derniere = (r: ControleRapportRow): Date | null => (r.executions.length ? new Date(Math.max(...r.executions.map(e => e.dateRealisation.getTime()))) : null)
const anneeDe = (p: Periode) => Number(p.fin.slice(0, 4))
const enPeriode = (r: ControleRapportRow, p: Periode) => r.executions.filter(e => dansPeriode(e.dateRealisation, p))

/** R-CTL-1 : plan de l'année de fin de période, taux de réalisation, retards, charge. */
export function buildRapportPlanControle(rows: ControleRapportRow[], periode: Periode, now: Date): RapportContenu {
  const actifs = rows.filter(r => r.actif)
  const plan = planAnnuel(actifs.map(r => ({ id: r.id, intitule: r.intitule, periodicite: r.periodicite, responsable: r.responsable, niveau: r.niveau, actif: r.actif, cle: r.cle, creeLe: r.creeLe })),
    actifs.flatMap(r => r.executions.map(e => ({ controleId: r.id, dateRealisation: e.dateRealisation, resultat: e.resultat }))), anneeDe(periode), now)
  const parId = new Map(actifs.map(r => [r.id, r]))
  const retards = plan.lignes.map(l => ({ r: parId.get(l.controleId)!, n: l.occurrences.filter(o => o.statut === 'EN_RETARD').length })).filter(x => x.n > 0).sort((a, b) => b.n - a.n)
  const niveaux = [...new Set(plan.lignes.map(l => parId.get(l.controleId)!.niveau))].sort()
  const parNiveau = niveaux.map((n): Cellule[] => {
    const occ = plan.lignes.filter(l => parId.get(l.controleId)!.niveau === n).flatMap(l => l.occurrences)
    return [n, occ.length, occ.filter(o => o.statut === 'REALISEE').length, occ.filter(o => o.statut === 'EN_RETARD').length]
  })
  const interrompus = actifs.filter(r => fluxInterrompu({ modeControle: r.modeControle, periodicite: r.periodicite, actif: r.actif, creeLe: r.creeLe }, derniere(r), now)).length
  const anomalies = actifs.reduce((n, r) => n + enPeriode(r, periode).filter(e => e.resultat === 'ANOMALIE').length, 0)
  const s = plan.synthese
  return meta('R-CTL-1', periode, now, [
    { id: 'synthese', blocs: [{ type: 'kpis', items: [
      { cle: 'prevues', valeur: s.prevues }, { cle: 'echues', valeur: s.echues }, { cle: 'realisees', valeur: s.realisees },
      { cle: 'enRetard', valeur: s.enRetard, alerte: s.enRetard > 0 }, { cle: 'tauxRealisation', valeur: s.tauxRealisation ?? 0, unite: 'pct' },
      { cle: 'anomalies', valeur: anomalies, alerte: anomalies > 0 }, { cle: 'fluxInterrompus', valeur: interrompus, alerte: interrompus > 0 },
    ] }] },
    { id: 'parMois', blocs: [tab(cols('mois', 'prevues', 'realisees', 'enRetard'), plan.parMois.map(m => [m.mois, m.prevues, m.realisees, m.enRetard]))] },
    { id: 'parNiveau', blocs: [tab(cols('niveau', 'prevues', 'realisees', 'enRetard'), parNiveau)] },
    { id: 'controlesEnRetard', blocs: [tab(cols('controle', 'responsable', 'periodesEnRetard'), retards.map(({ r, n }) => [r.intitule, r.responsable ?? { k: 'rapports.nonRenseigne' }, n]))] },
    { id: 'charge', blocs: [tab(cols('responsable', 'occurrences', 'pics'), plan.charge.map(c => [c.responsable || { k: 'rapports.nonRenseigne' }, c.parMois.reduce((a, b) => a + b, 0), c.pics.length]))] },
  ])
}

/** R-CTL-2 : conception × efficacité opérationnelle, contrôles clés détaillés. */
export function buildRapportEfficacite(rows: ControleRapportRow[], periode: Periode, now: Date): RapportContenu {
  const actifs = rows.filter(r => r.actif)
  const eval_ = actifs.map(r => {
    const conception = sanitizeConception(r.conception)
    const eff = evaluerEfficacite(enPeriode(r, periode))
    return { r, conception, eff, appreciation: appreciationControle(conception?.statut ?? null, eff.efficacite) }
  })
  const n = (a: string) => eval_.filter(e => e.appreciation === a).length
  const compter = (cle: (e: (typeof eval_)[number]) => string) => {
    const m = new Map<string, number>(); for (const e of eval_) m.set(cle(e), (m.get(cle(e)) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const execP = actifs.flatMap(r => enPeriode(r, periode))
  const conformes = execP.filter(e => e.resultat === 'CONFORME').length; const anomalies = execP.filter(e => e.resultat === 'ANOMALIE').length
  return meta('R-CTL-2', periode, now, [
    { id: 'synthese', blocs: [{ type: 'kpis', items: [
      { cle: 'actifs', valeur: actifs.length }, { cle: 'cles', valeur: actifs.filter(r => r.cle).length }, { cle: 'conceptionEvaluee', valeur: eval_.filter(e => e.conception).length },
      { cle: 'efficaces', valeur: n('EFFICACE') }, { cle: 'aSurveiller', valeur: n('A_SURVEILLER') }, { cle: 'defaillants', valeur: n('DEFAILLANT'), alerte: n('DEFAILLANT') > 0 },
      { cle: 'nonEvalues', valeur: n('NON_EVALUE') },
      { cle: 'tauxConformite', valeur: conformes + anomalies ? Math.round((conformes / (conformes + anomalies)) * 100) : 0, unite: 'pct' },
    ] }] },
    { id: 'controlesCles', blocs: [tab(cols('controle', 'conception', 'tauxConformite', 'appreciation'), eval_.filter(e => e.r.cle).map(e => [
      e.r.intitule, { k: `rapports.conception.${e.conception?.statut ?? 'NON_EVALUEE'}` }, e.eff.tauxConformite, { k: `rapports.appreciations.${e.appreciation}` }]))] },
    { id: 'parType', blocs: [tab(cols('type', 'nombre'), compter(e => e.r.typeControle ?? '').map(([t, c]) => [t ? { k: `rapports.typesControle.${t}` } : { k: 'rapports.nonType' }, c]))] },
    { id: 'parMode', blocs: [tab(cols('mode', 'nombre'), compter(e => e.r.modeControle).map(([m, c]) => [{ k: `rapports.modesControle.${m}` }, c]))] },
    { id: 'parAppreciation', blocs: [tab(cols('appreciation', 'nombre'), compter(e => e.appreciation).map(([a, c]) => [{ k: `rapports.appreciations.${a}` }, c]))] },
  ])
}

/** R-CTL-3 : anomalies de la période, récurrences (sur tout l'historique) et escalade. */
export function buildRapportAnomalies(rows: ControleRapportRow[], periode: Periode, now: Date): RapportContenu {
  const actifs = rows.filter(r => r.actif)
  const lignes = actifs.map(r => ({ r, nb: enPeriode(r, periode).filter(e => e.resultat === 'ANOMALIE').length, rec: analyseRecurrence(r.executions) }))
  const recurrentes = lignes.filter(l => l.rec.recurrente).sort((a, b) => b.rec.consecutives - a.rec.consecutives)
  const escalade = (l: (typeof lignes)[number]) => escaladeAnomalie(l.r.cle, l.rec)
  const totalAnomalies = lignes.reduce((n, l) => n + l.nb, 0)
  return meta('R-CTL-3', periode, now, [
    { id: 'synthese', blocs: [{ type: 'kpis', items: [
      { cle: 'anomalies', valeur: totalAnomalies, alerte: totalAnomalies > 0 }, { cle: 'controlesEnAnomalie', valeur: lignes.filter(l => l.nb > 0).length },
      { cle: 'recurrentes', valeur: recurrentes.length, alerte: recurrentes.length > 0 },
      { cle: 'escaladesN2', valeur: recurrentes.filter(l => escalade(l) === 'N2').length }, { cle: 'escaladesComite', valeur: recurrentes.filter(l => escalade(l) === 'COMITE').length, alerte: recurrentes.some(l => escalade(l) === 'COMITE') },
    ] }] },
    { id: 'recurrentes', blocs: [tab(cols('controle', 'responsable', 'consecutives', 'escalade'), recurrentes.map(l => [l.r.intitule, l.r.responsable ?? { k: 'rapports.nonRenseigne' }, l.rec.consecutives, { k: `rapports.escalades.${escalade(l)}` }]))] },
    { id: 'anomaliesParControle', blocs: [tab(cols('controle', 'nombre'), lignes.filter(l => l.nb > 0).sort((a, b) => b.nb - a.nb).slice(0, 10).map(l => [l.r.intitule, l.nb]))] },
  ])
}
