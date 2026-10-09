// ─── Registre des activités de traitement (RoPA — RGPD art. 30) ──────────────
// Cœur métier PUR du module DPO : modèle d'un traitement de données personnelles,
// contrôle de complétude (art. 30 §1), déclenchement d'une analyse d'impact (PIA /
// AIPD, art. 35). Aucune dépendance base — testable directement. L'UI/les routes/le
// modèle Prisma s'appuieront dessus (registre par organisation, réservé au DPO).

import { detectRgpdArt9 } from '@/lib/rgpd-sensitive'

/** Bases légales du traitement (RGPD art. 6 §1 a–f). */
export const BASES_LEGALES = [
  'consentement',
  'contrat',
  'obligation_legale',
  'interet_vital',
  'mission_service_public',
  'interet_legitime',
] as const
/** Base légale d'un traitement RGPD (art. 6) : consentement, contrat, obligation légale, intérêt légitime… */
export type BaseLegale = (typeof BASES_LEGALES)[number]

/** Activité de traitement du registre RGPD (art. 30) : finalité, base légale, données, destinataires, transferts, durée. */
export interface Traitement {
  id?: string
  nom: string
  finalite: string
  baseLegale: BaseLegale | ''
  categoriesPersonnes: string[]
  categoriesDonnees: string[]
  destinataires: string[]
  transfertHorsUE: boolean
  paysTransfert?: string
  garantiesTransfert?: string
  dureeConservation: string
  mesuresSecurite: string[]
  // Critères PIA (art. 35 §3) — renseignés par le DPO.
  grandeEchelle?: boolean
  surveillanceSystematique?: boolean
  /** Critères WP248 cochés par le DPO (cf. CRITERES_AIPD). */
  criteresAipd?: string[]
}

/**
 * Critères de risque élevé des lignes directrices du CEPD sur l'AIPD (WP248 rév. 01, adoptées le 4 octobre 2017,
 * section III.B.a), dans leur ordre : évaluation ou notation ; prise de décisions automatisée avec effet juridique ou
 * effet similaire significatif ; surveillance systématique ; données sensibles ou à caractère hautement personnel ;
 * données traitées à grande échelle ; croisement ou combinaison d'ensembles de données ; personnes vulnérables ;
 * utilisation innovante ou nouvelles solutions technologiques ou organisationnelles ; traitement qui empêche d'exercer
 * un droit ou de bénéficier d'un service ou d'un contrat. Libellés officiels : catalogue i18n `ropa.criteres`.
 */
export const CRITERES_AIPD = ['EVALUATION', 'DECISION_AUTOMATISEE', 'SURVEILLANCE', 'DONNEES_SENSIBLES', 'GRANDE_ECHELLE', 'CROISEMENT', 'PERSONNES_VULNERABLES', 'INNOVATION', 'EXCLUSION_DROIT'] as const
export type CritereAipd = (typeof CRITERES_AIPD)[number]

const S_MAX = 200
const T_MAX = 2000
const str = (v: unknown, max = S_MAX): string =>
  (typeof v === 'string' ? v : '').slice(0, max)
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(x => x.slice(0, S_MAX)).slice(0, 50) : []
const bool = (v: unknown): boolean => v === true || v === 'true' || v === 'oui' || v === 1
const asBase = (v: unknown): BaseLegale | '' =>
  (BASES_LEGALES as readonly string[]).includes(v as string) ? (v as BaseLegale) : ''

/** Normalise et borne un traitement fourni par le client (jamais de throw). */
export function sanitizeTraitement(v: unknown): Traitement {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    id: typeof o.id === 'string' ? o.id : undefined,
    nom: str(o.nom),
    finalite: str(o.finalite, T_MAX),
    baseLegale: asBase(o.baseLegale),
    categoriesPersonnes: strArr(o.categoriesPersonnes),
    categoriesDonnees: strArr(o.categoriesDonnees),
    destinataires: strArr(o.destinataires),
    transfertHorsUE: bool(o.transfertHorsUE),
    paysTransfert: str(o.paysTransfert),
    garantiesTransfert: str(o.garantiesTransfert, T_MAX),
    dureeConservation: str(o.dureeConservation),
    mesuresSecurite: strArr(o.mesuresSecurite),
    grandeEchelle: bool(o.grandeEchelle),
    surveillanceSystematique: bool(o.surveillanceSystematique),
    criteresAipd: Array.isArray(o.criteresAipd) ? CRITERES_AIPD.filter(c => (o.criteresAipd as unknown[]).includes(c)) : [],
  }
}

/**
 * Champs OBLIGATOIRES manquants au sens de l'art. 30 §1 (par traitement) : finalité,
 * catégories de personnes, catégories de données, destinataires, durée de conservation,
 * description des mesures de sécurité (art. 32). En cas de transfert hors UE, les
 * garanties (art. 44-46) sont exigées. `nom` est requis comme libellé du registre.
 */
export function champsManquantsArt30(t: Traitement): string[] {
  const manquants: string[] = []
  if (!t.nom?.trim()) manquants.push('nom')
  if (!t.finalite?.trim()) manquants.push('finalite')
  if (t.categoriesPersonnes.length === 0) manquants.push('categoriesPersonnes')
  if (t.categoriesDonnees.length === 0) manquants.push('categoriesDonnees')
  if (t.destinataires.length === 0) manquants.push('destinataires')
  if (!t.dureeConservation?.trim()) manquants.push('dureeConservation')
  if (t.mesuresSecurite.length === 0) manquants.push('mesuresSecurite')
  if (t.transfertHorsUE && !t.garantiesTransfert?.trim()) manquants.push('garantiesTransfert')
  return manquants
}

/** Verdict AIPD : requise (≥ 2 critères), à examiner (1 critère), non requise (aucun) ; motifs = critères retenus. */
export interface PiaVerdict {
  requis: boolean
  niveau: 'REQUISE' | 'A_EXAMINER' | 'NON'
  motifs: CritereAipd[]
}

/** Critères retenus : ceux cochés par le DPO, plus ceux que les champs du traitement établissent (catégories
 *  particulières de l'art. 9 détectées, grande échelle, surveillance systématique) ; ordre des lignes directrices. */
export type TraitementCriteres = Pick<Traitement, 'categoriesDonnees' | 'grandeEchelle' | 'surveillanceSystematique' | 'criteresAipd'>
export function criteresAipd(t: TraitementCriteres): CritereAipd[] {
  const retenus = new Set<string>(t.criteresAipd ?? [])
  if (detectRgpdArt9(t.categoriesDonnees.map(nom => ({ nom }))).length > 0) retenus.add('DONNEES_SENSIBLES')
  if (t.grandeEchelle) retenus.add('GRANDE_ECHELLE')
  if (t.surveillanceSystematique) retenus.add('SURVEILLANCE')
  return CRITERES_AIPD.filter(c => retenus.has(c))
}

/**
 * Une AIPD (art. 35) est-elle requise ? Lignes directrices WP248 rév. 01 : « dans la plupart des cas », un traitement
 * qui satisfait à deux critères nécessite une AIPD ; un seul critère peut suffire selon le cas (« à examiner »). Aide à
 * la décision, pas un avis juridique : le DPO reste décisionnaire et documente sa décision.
 */
export function piaRequis(t: TraitementCriteres): PiaVerdict {
  const motifs = criteresAipd(t)
  const niveau = motifs.length >= 2 ? 'REQUISE' : motifs.length === 1 ? 'A_EXAMINER' : 'NON'
  return { requis: niveau === 'REQUISE', niveau, motifs }
}

/** Évaluation d'un traitement RGPD : complétude (champs manquants) + verdict AIPD. */
export interface TraitementEvaluation {
  complet: boolean
  champsManquants: string[]
  pia: PiaVerdict
}

/** Synthèse par traitement pour le tableau de bord DPO. */
export function evaluerTraitement(t: Traitement): TraitementEvaluation {
  const champsManquants = champsManquantsArt30(t)
  return { complet: champsManquants.length === 0, champsManquants, pia: piaRequis(t) }
}
