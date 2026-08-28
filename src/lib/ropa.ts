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
export type BaseLegale = (typeof BASES_LEGALES)[number]

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
}

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

export interface PiaVerdict {
  requis: boolean
  motifs: string[]
}

/**
 * Une analyse d'impact (PIA / AIPD, art. 35) est-elle requise ? Modèle simplifié
 * (aide à la décision, pas un avis juridique) : (b) traitement de données sensibles
 * art. 9 → oui ; (c) surveillance systématique à grande échelle → oui. Le DPO reste
 * décisionnaire ; renvoie les motifs pour justification.
 */
export function piaRequis(t: Traitement): PiaVerdict {
  const motifs: string[] = []
  const sensibles = detectRgpdArt9(t.categoriesDonnees.map(nom => ({ nom })))
  if (sensibles.length > 0) motifs.push('donnees_sensibles_art9')
  if (t.grandeEchelle && t.surveillanceSystematique) motifs.push('surveillance_systematique_grande_echelle')
  return { requis: motifs.length > 0, motifs }
}

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
