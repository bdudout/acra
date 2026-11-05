// ─── Risques proposés depuis le registre TIC et la résilience (lot L4) — PUR ─────────────────────────────────────────
// Aucun risque n'est créé automatiquement : les propositions sont CALCULÉES à la volée à partir du registre
// d'informations (contrats TIC), des usages de services de tiers et des fonctions critiques ou importantes
// (cartographie lib/dependances-critiques, dont le calcul de concentration est réutilisé). Un utilisateur habilité
// valide (→ RiskItem, sourceType 'proposition-tic', sourceId = clé) ou écarte (→ PropositionRisqueEcartee).
// Clé stable `TYPE:idOrigine` : déduplication des écartées et des déjà validées. Libellés : t.propositionsTic (i18n ×5),
// durées formatées dans la langue de `t` (minutes brutes dans la proposition).
// Choix de conception :
//  - risque validé puis SUPPRIMÉ du registre → la proposition RÉAPPARAÎT (plus aucun RiskItem ne porte la clé) tant que
//    l'écart d'origine subsiste ;
//  - proposition ÉCARTÉE → définitivement pour cette clé (même type, même objet d'origine), même si l'écart persiste ;
//    un nouvel objet d'origine (autre contrat, autre processus) produit une nouvelle clé.
// Unicité : index unique partiel RiskItem(organizationId, sourceId) WHERE sourceType = 'proposition-tic' (migration
// 20261103220000) ; PropositionRisqueEcartee unique (organizationId, cle).
// Testé : propositions-risques-tic.test.ts, propositions-risques-tic.server.test.ts.
import { fr, en, de, es, it, type Locale, type Translations } from '@/lib/i18n'
import type { FamilleRisqueTic } from '@/lib/famille-risque-tic'
import { analyserDependances, type FonctionDep, type UsageDep } from '@/lib/dependances-critiques'
import { prochaineEvaluation } from '@/lib/tier-evaluation'

/** `RiskItem.sourceType` d'un risque créé par validation d'une proposition ; `sourceId` = clé de la proposition. */
export const SOURCE_PROPOSITION_TIC = 'proposition-tic'

export const TYPES_PROPOSITION_TIC = [
  'CONTRAT_SANS_SORTIE', 'CONCENTRATION_PRESTATAIRE', 'PRESTATAIRE_NON_EVALUE', 'RTO_AU_DELA_TOLERANCE', 'REPRISE_AU_DELA_RTO',
] as const
export type TypePropositionTic = (typeof TYPES_PROPOSITION_TIC)[number]
export type OriginePropositionTic = 'CONTRAT_TIC' | 'TIERS' | 'PROCESSUS'

/** Contrat TIC du registre d'informations (seuls criticité et stratégie de sortie importent ici). */
export interface ContratTicSource { id: string; reference: string; prestataireNom: string; criticite: string; strategieSortie: string | null }

export interface PropositionRisqueTic {
  cle: string
  type: TypePropositionTic
  famille: FamilleRisqueTic
  origine: { type: OriginePropositionTic; id: string; libelle: string; lien: string }
  /** Processus à rattacher au risque créé (propositions de continuité). */
  processusId: string | null
  /** Valeurs textuelles interpolées dans les libellés i18n. */
  params: Record<string, string>
  /** Durées (minutes brutes) interpolées après formatage dans la langue du lecteur. */
  durees?: Record<string, number>
  gravite: number
  vraisemblance: number
}

const LONGUEUR_MAX_CLE = 200
const FCI = ['CRITIQUE', 'IMPORTANTE']
const graviteCriticite = (c: string | null | undefined) => (c === 'CRITIQUE' ? 4 : 3)

export const cleProposition = (type: TypePropositionTic, id: string) => `${type}:${id}`

/** Vrai si `v` est une clé de proposition bien formée (type connu, id non vide, longueur bornée). */
export function estClePropositionTic(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > LONGUEUR_MAX_CLE) return false
  const i = v.indexOf(':')
  return i > 0 && i < v.length - 1 && (TYPES_PROPOSITION_TIC as readonly string[]).includes(v.slice(0, i))
}

const LOCALE_DE_T: [Translations, Locale][] = [[fr, 'fr'], [en, 'en'], [de, 'de'], [es, 'es'], [it, 'it']]

/** Durée lisible dans la langue (minutes → « 45 min », « 1,5 h » en fr / « 1.5 h » en en ; une décimale au plus). */
function duree(m: number, locale: Locale): string {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  return m < 60 ? `${nf.format(m)} min` : `${nf.format(m / 60)} h`
}

/** Usage non évalué : aucune évaluation validée, ou réévaluation (12 mois après validation) échue. */
function usageNonEvalue(u: UsageDep, maintenant: Date): boolean {
  if (u.evaluation === undefined) return !u.evalue
  if (!u.evaluation || u.evaluation.statut !== 'VALIDEE') return true
  const echeance = prochaineEvaluation(u.evaluation.valideLe ? new Date(u.evaluation.valideLe) : null)
  return !echeance || echeance.getTime() < maintenant.getTime()
}

export function calculerPropositionsRisquesTic(input: { fonctions: FonctionDep[]; contrats: ContratTicSource[]; maintenant: Date }): PropositionRisqueTic[] {
  const { fonctions, contrats, maintenant } = input
  const out: PropositionRisqueTic[] = []
  const fci = fonctions.filter(f => FCI.includes(f.criticiteDora))
  const criticiteParNom = new Map(fci.map(f => [f.nom, f.criticiteDora]))
  const pireGravite = (noms: string[]) => Math.max(...noms.map(n => graviteCriticite(criticiteParNom.get(n))))

  // 1. Contrat soutenant une fonction critique ou importante sans stratégie de sortie (DORA art. 28 § 8).
  for (const c of contrats) {
    if (!FCI.includes(c.criticite) || c.strategieSortie?.trim()) continue
    out.push({
      cle: cleProposition('CONTRAT_SANS_SORTIE', c.id), type: 'CONTRAT_SANS_SORTIE', famille: 'TIERS_TIC',
      origine: { type: 'CONTRAT_TIC', id: c.id, libelle: `${c.reference} — ${c.prestataireNom}`, lien: '/registre-tic' },
      processusId: null, params: { contrat: c.reference, prestataire: c.prestataireNom }, gravite: graviteCriticite(c.criticite), vraisemblance: 2,
    })
  }

  // 2. Concentration : même prestataire derrière plusieurs fonctions (calcul de la cartographie, DORA art. 29).
  for (const c of analyserDependances(fci).concentration.tiers) {
    out.push({
      cle: cleProposition('CONCENTRATION_PRESTATAIRE', c.tiersId), type: 'CONCENTRATION_PRESTATAIRE', famille: 'TIERS_TIC',
      origine: { type: 'TIERS', id: c.tiersId, libelle: c.tiersNom, lien: '/tiers' },
      processusId: null, params: { tiers: c.tiersNom, fonctions: c.fonctions.join(', ') },
      gravite: pireGravite(c.fonctions), vraisemblance: Math.min(4, 1 + c.fonctions.length),
    })
  }

  // 3. Prestataire d'une fonction critique ou importante sans évaluation validée (ou réévaluation échue).
  const nonEvalues = new Map<string, { nom: string; fonctions: Set<string> }>()
  for (const f of fci) for (const u of f.usages) {
    if (!usageNonEvalue(u, maintenant)) continue
    const t = nonEvalues.get(u.tiersId) ?? { nom: u.tiersNom, fonctions: new Set<string>() }
    t.fonctions.add(f.nom); nonEvalues.set(u.tiersId, t)
  }
  for (const [tiersId, t] of nonEvalues) {
    const noms = [...t.fonctions].sort()
    out.push({
      cle: cleProposition('PRESTATAIRE_NON_EVALUE', tiersId), type: 'PRESTATAIRE_NON_EVALUE', famille: 'TIERS_TIC',
      origine: { type: 'TIERS', id: tiersId, libelle: t.nom, lien: '/tiers' },
      processusId: null, params: { tiers: t.nom, fonctions: noms.join(', ') }, gravite: pireGravite(noms), vraisemblance: 3,
    })
  }

  // 4. Continuité métier : RTO au-delà de la tolérance d'impact, ou reprise testée au-delà du RTO.
  for (const f of fci) {
    const origine = { type: 'PROCESSUS' as const, id: f.id, libelle: f.nom, lien: '/reglementaire' }
    const gravite = graviteCriticite(f.criticiteDora)
    if (f.rtoMinutes != null && f.toleranceImpactMinutes != null && f.rtoMinutes > f.toleranceImpactMinutes) {
      out.push({
        cle: cleProposition('RTO_AU_DELA_TOLERANCE', f.id), type: 'RTO_AU_DELA_TOLERANCE', famille: 'CONTINUITE_METIER_TIC', origine, processusId: f.id,
        params: { fonction: f.nom }, durees: { rto: f.rtoMinutes, tolerance: f.toleranceImpactMinutes }, gravite, vraisemblance: 3,
      })
    }
    const d = f.dernierTest?.dureeRepriseMinutes
    if (f.dernierTest && d != null && f.rtoMinutes != null && d > f.rtoMinutes) {
      const auDelaTolerance = f.toleranceImpactMinutes != null && d > f.toleranceImpactMinutes
      out.push({
        cle: cleProposition('REPRISE_AU_DELA_RTO', f.id), type: 'REPRISE_AU_DELA_RTO', famille: 'CONTINUITE_METIER_TIC', origine, processusId: f.id,
        params: { fonction: f.nom, date: f.dernierTest.date }, durees: { duree: d, rto: f.rtoMinutes }, gravite, vraisemblance: auDelaTolerance ? 4 : 3,
      })
    }
  }
  return out
}

/** Propositions encore à traiter : ni écartées, ni déjà validées (un risque du registre porte la clé). */
export function propositionsOuvertes(props: PropositionRisqueTic[], opts: { ecartees: Iterable<string>; validees: Iterable<string> }): PropositionRisqueTic[] {
  const exclues = new Set([...opts.ecartees, ...opts.validees])
  return props.filter(p => !exclues.has(p.cle))
}

/** Intitulé et description de la proposition dans la langue de `t` (durées formatées dans cette langue). */
export function libellerProposition(p: PropositionRisqueTic, t: Translations): { intitule: string; description: string } {
  const l = t.propositionsTic.types[p.type]
  const locale = LOCALE_DE_T.find(([x]) => x === t)?.[1] ?? 'fr'
  const valeur = (k: string) => p.params[k] ?? (p.durees?.[k] != null ? duree(p.durees[k], locale) : undefined)
  const remplir = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => valeur(k) ?? m)
  return { intitule: remplir(l.titre), description: remplir(l.description) }
}
