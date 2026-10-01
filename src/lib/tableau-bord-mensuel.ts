/**
 * tableau-bord-mensuel.ts — Tableau de bord mensuel des RSSI et gestionnaires des risques. Module PUR.
 * Pour une organisation et un mois écoulé : indicateurs clés des modules actifs et une liste courte
 * de « points d'attention » nommés (le plus important d'abord). Réutilise les règles des modules
 * (posture risque, appétit, efficacité des contrôles, synthèse des constats, KRI, DORA, dérogations) :
 * aucune règle métier dupliquée. Le cron `tableau-bord-mensuel` assemble un e-mail par personne.
 */
import { postureBucket } from './grc-rollup'
import { estHorsAppetit, type AppetitConfig } from './appetit'
import { evaluerEfficacite } from './controle'
import { synthetiserConstats } from './audit'
import { evaluerKri, type KriSens } from './kri'
import { classifierIncident, estEvalueDora, type DoraCriteres } from './dora'
import { perteNette } from './incident'
import { buildDerogationDigest, type DerogationStatut } from './derogation'

export type Ton = 'neutral' | 'warning' | 'danger' | 'success'

export type IndicateurCle =
  | 'risquesEleves' | 'horsAppetit' | 'plansEnRetard' | 'incidentsMois' | 'incidentsMajeurs' | 'perteNetteMois'
  | 'tauxConformite' | 'anomaliesMois' | 'recosEnRetard' | 'constatsCritiques' | 'preconisationsEnRetard'
  | 'kriEnAlerte' | 'derogationsAExpirer' | 'derogationsExpirees' | 'decisionsEnAttente'
export interface Indicateur { cle: IndicateurCle; valeur: number; unite?: '%' | '€'; ton: Ton }

export type AttentionType =
  | 'RISQUE_ELEVE' | 'RISQUE_HORS_APPETIT' | 'INCIDENT_MAJEUR' | 'PLAN_EN_RETARD' | 'CONSTAT_CRITIQUE'
  | 'RECO_EN_RETARD' | 'KRI_CRITIQUE' | 'DEROGATION_EXPIREE' | 'DEROGATION_A_EXPIRER'
/** Point d'attention : `date` = échéance ou date de fin (AAAA-MM-JJ), `niveau` = cotation résiduelle. */
export interface PointAttention { type: AttentionType; intitule: string; date?: string | null; niveau?: number; ton: Ton }

export interface DonneesTableauBord {
  modules: { registre: boolean; incidents: boolean; dora: boolean; controles: boolean; audit: boolean; kri: boolean; derogations: boolean }
  appetit: AppetitConfig | null
  risques: { intitule: string; taxonomieCode: string | null; niveauInherent: number | null; niveauResiduel: number | null }[]
  plans: { titre: string; statut: string; echeance: Date | null }[]
  /** Incidents déclarés pendant le mois. */
  incidents: { intitule: string; statut: string; montantBrut: number | null; recuperations: number | null; doraCriteres: unknown }[]
  /** Exécutions de contrôles réalisées pendant le mois. */
  executions: { resultat: string; dateRealisation: Date }[]
  constats: { intitule: string; criticite: number | null; statut: string; echeance: Date | null }[]
  preconisations: { intitule: string; statut: string; echeance: Date | null }[]
  kri: { intitule: string; sens: string; seuilAlerte: number | null; seuilCritique: number | null; derniereValeur: number | null }[]
  derogations: { intitule: string; statut: string; dateFin: Date | null }[]
  derogationAlerteJours: number
  /** Analyses soumises, dérogations en revue, préconisations réalisées à vérifier. */
  decisionsEnAttente: number
}

export interface TableauBord { indicateurs: Indicateur[]; attention: PointAttention[] }

const MAX_PAR_TYPE = 3
const MAX_ATTENTION = 12
const jour = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)
const ouvert = (statut: string) => !['FAIT', 'RESOLU', 'VERIFIE', 'ACCEPTE', 'CLOS', 'CLOTURE'].includes(statut)
const enRetard = (x: { statut: string; echeance: Date | null }, now: Date) => ouvert(x.statut) && !!x.echeance && x.echeance.getTime() < now.getTime()
const parEcheance = <T extends { echeance: Date | null }>(a: T, b: T) => (a.echeance?.getTime() ?? 0) - (b.echeance?.getTime() ?? 0)
const ton = (n: number, danger = true): Ton => (n > 0 ? (danger ? 'danger' : 'warning') : 'success')

export function construireTableauBord(d: DonneesTableauBord, now: Date): TableauBord {
  const indicateurs: Indicateur[] = []
  const attention: PointAttention[] = []
  const m = d.modules

  if (m.registre) {
    const eleves = d.risques.filter(r => postureBucket({ organizationId: '', niveauInherent: r.niveauInherent, niveauResiduel: r.niveauResiduel }) === 'eleve')
      .sort((a, b) => (b.niveauResiduel ?? b.niveauInherent ?? 0) - (a.niveauResiduel ?? a.niveauInherent ?? 0))
    indicateurs.push({ cle: 'risquesEleves', valeur: eleves.length, ton: ton(eleves.length) })
    for (const r of eleves.slice(0, MAX_PAR_TYPE)) attention.push({ type: 'RISQUE_ELEVE', intitule: r.intitule, niveau: r.niveauResiduel ?? r.niveauInherent ?? undefined, ton: 'danger' })
    if (d.appetit) {
      const appetit = d.appetit
      const hors = d.risques.filter(r => estHorsAppetit({ taxonomieCode: r.taxonomieCode, niveauResiduel: r.niveauResiduel }, appetit))
      indicateurs.push({ cle: 'horsAppetit', valeur: hors.length, ton: ton(hors.length) })
      for (const r of hors.filter(h => !eleves.slice(0, MAX_PAR_TYPE).includes(h)).slice(0, MAX_PAR_TYPE)) {
        attention.push({ type: 'RISQUE_HORS_APPETIT', intitule: r.intitule, niveau: r.niveauResiduel ?? undefined, ton: 'danger' })
      }
    }
  }

  const plansRetard = d.plans.filter(p => enRetard(p, now)).sort(parEcheance)
  indicateurs.push({ cle: 'plansEnRetard', valeur: plansRetard.length, ton: ton(plansRetard.length, false) })
  for (const p of plansRetard.slice(0, MAX_PAR_TYPE)) attention.push({ type: 'PLAN_EN_RETARD', intitule: p.titre, date: jour(p.echeance), ton: 'warning' })

  if (m.incidents) {
    const retenus = d.incidents.filter(i => i.statut !== 'REJETE')
    indicateurs.push({ cle: 'incidentsMois', valeur: retenus.length, ton: retenus.length ? 'warning' : 'success' })
    if (m.dora) {
      const majeurs = retenus.filter(i => estEvalueDora(i.doraCriteres as DoraCriteres) && classifierIncident(i.doraCriteres as DoraCriteres).classe === 'MAJEUR')
      indicateurs.push({ cle: 'incidentsMajeurs', valeur: majeurs.length, ton: ton(majeurs.length) })
      for (const i of majeurs.slice(0, MAX_PAR_TYPE)) attention.push({ type: 'INCIDENT_MAJEUR', intitule: i.intitule, ton: 'danger' })
    }
    const perte = Math.round(retenus.reduce((s, i) => s + (perteNette(i.montantBrut, i.recuperations) ?? 0), 0))
    if (perte) indicateurs.push({ cle: 'perteNetteMois', valeur: perte, unite: '€', ton: 'warning' })
  }

  if (m.controles) {
    const eff = evaluerEfficacite(d.executions)
    if (eff.tauxConformite != null) indicateurs.push({ cle: 'tauxConformite', valeur: Math.round(eff.tauxConformite), unite: '%', ton: eff.tauxConformite >= 90 ? 'success' : eff.tauxConformite >= 70 ? 'warning' : 'danger' })
    indicateurs.push({ cle: 'anomaliesMois', valeur: eff.anomalies, ton: ton(eff.anomalies, false) })
    const precoRetard = d.preconisations.filter(p => enRetard(p, now))
    indicateurs.push({ cle: 'preconisationsEnRetard', valeur: precoRetard.length, ton: ton(precoRetard.length, false) })
  }

  if (m.audit) {
    const s = synthetiserConstats(d.constats, now)
    indicateurs.push({ cle: 'recosEnRetard', valeur: s.enRetard, ton: ton(s.enRetard, false) })
    indicateurs.push({ cle: 'constatsCritiques', valeur: s.critiques, ton: ton(s.critiques) })
    const critiques = d.constats.filter(c => c.criticite === 4 && ouvert(c.statut))
    for (const c of critiques.slice(0, MAX_PAR_TYPE)) attention.push({ type: 'CONSTAT_CRITIQUE', intitule: c.intitule, date: jour(c.echeance), ton: 'danger' })
    for (const c of d.constats.filter(x => enRetard(x, now) && !critiques.includes(x)).sort(parEcheance).slice(0, MAX_PAR_TYPE)) {
      attention.push({ type: 'RECO_EN_RETARD', intitule: c.intitule, date: jour(c.echeance), ton: 'warning' })
    }
  }

  if (m.kri) {
    const statuts = d.kri.map(k => ({ k, statut: evaluerKri(k.derniereValeur, { sens: k.sens as KriSens, seuilAlerte: k.seuilAlerte, seuilCritique: k.seuilCritique }) }))
    const enAlerte = statuts.filter(x => x.statut === 'ALERTE' || x.statut === 'CRITIQUE')
    indicateurs.push({ cle: 'kriEnAlerte', valeur: enAlerte.length, ton: ton(enAlerte.length, !enAlerte.every(x => x.statut === 'ALERTE')) })
    for (const x of statuts.filter(s => s.statut === 'CRITIQUE').slice(0, MAX_PAR_TYPE)) attention.push({ type: 'KRI_CRITIQUE', intitule: x.k.intitule, ton: 'danger' })
  }

  if (m.derogations) {
    const digest = buildDerogationDigest(d.derogations.map((x, i) => ({ id: String(i), intitule: x.intitule, statut: x.statut as DerogationStatut, dateFin: x.dateFin })), d.derogationAlerteJours, now)
    indicateurs.push({ cle: 'derogationsAExpirer', valeur: digest.expireBientot, ton: ton(digest.expireBientot, false) })
    indicateurs.push({ cle: 'derogationsExpirees', valeur: digest.expiree, ton: ton(digest.expiree) })
    for (const x of digest.aRisque.slice(0, MAX_PAR_TYPE)) {
      const fin = d.derogations[Number(x.id)]?.dateFin ?? null
      attention.push({ type: x.etat === 'EXPIREE' ? 'DEROGATION_EXPIREE' : 'DEROGATION_A_EXPIRER', intitule: x.intitule, date: jour(fin), ton: x.etat === 'EXPIREE' ? 'danger' : 'warning' })
    }
  }

  indicateurs.push({ cle: 'decisionsEnAttente', valeur: d.decisionsEnAttente, ton: ton(d.decisionsEnAttente, false) })

  // Le plus grave d'abord (danger), dans l'ordre des modules ; liste courte.
  const rang = (p: PointAttention) => (p.ton === 'danger' ? 0 : 1)
  return { indicateurs, attention: attention.map((p, i) => ({ p, i })).sort((a, b) => rang(a.p) - rang(b.p) || a.i - b.i).map(x => x.p).slice(0, MAX_ATTENTION) }
}

/** Mois écoulé : [début, fin[ en UTC, et clé de période « AAAA-MM » (anti-doublon de l'envoi). */
export function moisEcoule(now: Date): { debut: Date; fin: Date; periode: string } {
  const fin = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const debut = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() - 1, 1))
  return { debut, fin, periode: debut.toISOString().slice(0, 7) }
}
