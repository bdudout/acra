/**
 * exemples-context.ts — Pertinence contextuelle des exemples d'atelier.
 *
 * Réordonne (sans rien supprimer) les exemples proposés dans les ateliers selon
 * le CONTEXTE : secteur d'activité de l'analyse + réponses déjà saisies
 * (mots-clés). Les exemples les plus pertinents remontent en tête et sont
 * marqués `pertinent` (badge UI). 100 % local, aucune IA externe.
 *
 * Stratégie heuristique : pas de tag sur le catalogue. On dérive un vocabulaire
 * du secteur + des `extraKeywords` (noms des biens supports / valeurs métier déjà
 * saisis → volet « selon le support et les réponses précédentes »), puis on score
 * chaque exemple par recouvrement avec son texte (nom + description + impacts).
 *
 * Module pur (sans React) → testé unitairement (exemples-context.test.ts).
 */

export interface RankableExemple {
  nom?: string
  description?: string
  impacts?: string[]
  [k: string]: unknown
}

export interface RankContext {
  secteur?: string | null
  /** Sous-secteur (libellé LOCALISÉ) — affine le scoring (issue #25). */
  sousSecteur?: string | null
  /** Mots-clés issus des réponses précédentes (noms de biens/valeurs métier déjà saisis). */
  extraKeywords?: string[]
}

// Mots vides ignorés lors de la tokenisation d'un libellé de sous-secteur (multi-langue).
const SOUS_SECTEUR_STOPWORDS = new Set(['avec', 'sans', 'pour', 'dans', 'and', 'the', 'für', 'mit', 'con', 'per', 'del', 'della'])

// Vocabulaire indicatif par famille de secteur (mots-clés en minuscules, sous-chaînes).
// Étendu volontairement « large » : sert au scoring par recouvrement, pas à une taxonomie.
const SECTOR_VOCAB: { match: string[]; vocab: string[] }[] = [
  { match: ['santé', 'sante', 'médico', 'medico', 'hôpital', 'hopital', 'health', 'soin', 'clinique'],
    vocab: ['patient', 'médical', 'medical', 'soin', 'hôpital', 'hopital', 'dpi', 'dossier patient', 'prescription', 'médicament', 'medicament', 'santé', 'sante', 'ehpad', 'imagerie', 'laboratoire'] },
  { match: ['banque', 'finance', 'bancaire', 'assur', 'fintech', 'financ'],
    vocab: ['paiement', 'transaction', 'bancaire', 'carte', 'compte', 'crédit', 'credit', 'swift', 'fraude', 'virement', 'dab', 'core banking', 'titres', 'assurance', 'sinistre'] },
  { match: ['défense', 'defense', 'militaire', 'national'],
    vocab: ['classifié', 'classifie', 'défense', 'defense', 'militaire', 'souverain', 'secret', 'sensible', 'opération', 'operation'] },
  { match: ['énergie', 'energie', 'utilities', 'eau', 'nucléaire', 'nucleaire', 'energy'],
    vocab: ['scada', 'automate', 'plc', 'ot', 'ics', 'production', 'réseau électrique', 'reseau electrique', 'nucléaire', 'nucleaire', 'turbine', 'capteur', 'supervision', 'distribution'] },
  { match: ['industrie', 'manufactur', 'usine', 'industry'],
    vocab: ['scada', 'automate', 'plc', 'ot', 'ics', 'production', 'usine', 'chaîne', 'chaine', 'fabrication', 'maintenance', 'robot', 'capteur'] },
  { match: ['transport', 'logistique', 'logistics', 'ferroviaire', 'aérien', 'aerien'],
    vocab: ['transport', 'logistique', 'flotte', 'fret', 'livraison', 'ferroviaire', 'aérien', 'aerien', 'entrepôt', 'entrepot', 'gps', 'tracking'] },
  { match: ['télécom', 'telecom', 'communication'],
    vocab: ['réseau', 'reseau', 'télécom', 'telecom', 'abonné', 'abonne', 'opérateur', 'operateur', 'voix', 'antenne', 'box', 'roaming'] },
  { match: ['administration', 'public', 'collectivit', 'état', 'etat', 'government'],
    vocab: ['usager', 'état civil', 'etat civil', 'collectivité', 'collectivite', 'service public', 'administr', 'citoyen', 'urbanisme', 'délibération', 'deliberation'] },
  { match: ['éducation', 'education', 'recherche', 'université', 'universite', 'enseign', 'research'],
    vocab: ['étudiant', 'etudiant', 'élève', 'eleve', 'recherche', 'université', 'universite', 'scolaire', 'cours', 'note', 'diplôme', 'diplome'] },
  { match: ['commerce', 'distribution', 'retail', 'e-commerce'],
    vocab: ['client', 'commande', 'panier', 'stock', 'livraison', 'paiement', 'caisse', 'fidélité', 'fidelite', 'catalogue', 'e-commerce'] },
  { match: ['juridique', 'avocat', 'notaire', 'juriste', 'barreau', 'legal'],
    vocab: ['dossier', 'client', 'confidentialité', 'confidentialite', 'procédure', 'procedure', 'contentieux', 'contrat', 'honoraires', 'carpa', 'correspondance'] },
  { match: ['informatique', 'numérique', 'numerique', 'saas', 'startup', 'logiciel', 'éditeur', 'editeur', 'digital'],
    vocab: ['ci/cd', 'pipeline', 'conteneur', 'container', 'cloud', 'api', 'secret', 'dépendance', 'dependance', 'iac', 'terraform', 'kubernetes', 'registre', 'déploiement', 'deploiement', 'code source', 'sast'] },
  { match: ['agricol', 'agro', 'agriculture', 'élevage', 'elevage', 'ferme'],
    vocab: ['exploitation', 'récolte', 'recolte', 'élevage', 'elevage', 'traçabilité', 'tracabilite', 'coopérative', 'cooperative', 'phytosanitaire', 'irrigation', 'capteur'] },
  { match: ['immobilier', 'construction', 'bâtiment', 'batiment', 'btp'],
    vocab: ['bail', 'locataire', 'copropriété', 'copropriete', 'chantier', 'permis', 'transaction', 'mandat', 'gestion locative', 'bim'] },
  { match: ['média', 'media', 'presse', 'culture', 'audiovisuel', 'édition', 'edition'],
    vocab: ['rédaction', 'redaction', 'article', 'diffusion', 'audience', 'abonné', 'abonne', 'contenu', 'source', 'publication', 'droits'] },
  { match: ['tourisme', 'hôtel', 'hotel', 'hôtellerie', 'hotellerie', 'restauration', 'hospitality'],
    vocab: ['réservation', 'reservation', 'client', 'séjour', 'sejour', 'chambre', 'paiement', 'fidélité', 'fidelite', 'pms', 'check-in'] },
  { match: ['association', 'économie sociale', 'economie sociale', 'non-profit', 'nonprofit'],
    vocab: ['adhérent', 'adherent', 'don', 'donateur', 'bénévole', 'benevole', 'cotisation', 'membre', 'subvention', 'rgpd'] },
]

// Mots-clés non significatifs (articles, prépositions…) écartés du scoring.
const STOPWORDS = new Set([
  'avec', 'dans', 'pour', 'sans', 'sous', 'leur', 'leurs', 'cette', 'cet', 'des',
  'les', 'une', 'aux', 'par', 'sur', 'que', 'qui', 'son', 'ses', 'nos', 'vos',
  'the', 'and', 'for', 'with', 'from', 'this', 'that',
])

/** Retire les accents et passe en minuscules (comparaison robuste). */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Extrait des mots-clés significatifs des réponses déjà saisies (valeurs métier,
 * biens supports…) pour alimenter `extraKeywords` → volet « selon les réponses
 * précédentes ». Tokenise nom + description, normalise (sans accents), déduplique,
 * écarte les mots trop courts (< 4 lettres) et les mots vides.
 */
export function keywordsFromAnswers(
  answers: { nom?: string; description?: string }[],
): string[] {
  const out = new Set<string>()
  for (const a of answers ?? []) {
    const text = `${a?.nom ?? ''} ${a?.description ?? ''}`
    for (const raw of normalize(text).split(/[^a-z0-9]+/)) {
      if (raw.length >= 4 && !STOPWORDS.has(raw)) out.add(raw)
    }
  }
  return [...out]
}

/** Vocabulaire de mots-clés pour un secteur donné (par famille ; [] si inconnu). */
export function vocabForSecteur(secteur?: string | null): string[] {
  const s = (secteur ?? '').toLowerCase()
  if (!s) return []
  const fam = SECTOR_VOCAB.find(f => f.match.some(m => s.includes(m)))
  return fam ? fam.vocab : []
}

/**
 * Vocabulaire issu d'un libellé de sous-secteur LOCALISÉ : tokenise le libellé en
 * mots significatifs (≥ 4 lettres, hors mots vides). Comme le libellé est dans la
 * langue de l'utilisateur, ces mots-clés matchent les exemples localisés.
 */
export function vocabForSousSecteur(sousSecteurLabel?: string | null): string[] {
  const s = (sousSecteurLabel ?? '').toLowerCase()
  if (!s) return []
  return [...new Set(
    s.split(/[^a-zà-ÿ]+/i)
      .map(w => w.trim())
      .filter(w => w.length >= 4 && !SOUS_SECTEUR_STOPWORDS.has(w))
  )]
}

/** Score d'un exemple = nombre de mots-clés présents dans son texte (nom + description + impacts). */
export function scoreExemple(ex: RankableExemple, keywords: string[]): number {
  if (!keywords.length) return 0
  const hay = `${ex.nom ?? ''} ${ex.description ?? ''} ${(ex.impacts ?? []).join(' ')}`.toLowerCase()
  let score = 0
  for (const kw of keywords) {
    const k = kw.toLowerCase().trim()
    if (k && hay.includes(k)) score++
  }
  return score
}

/**
 * Réordonne les exemples (pertinents en tête) selon le contexte, sans rien
 * supprimer. Tri stable (ordre d'origine conservé à score égal). Chaque exemple
 * renvoyé porte un drapeau `pertinent` (score > 0) pour l'affichage d'un badge.
 */
export function rankExemples<T extends RankableExemple>(
  exemples: T[],
  ctx: RankContext,
): (T & { pertinent: boolean })[] {
  const keywords = [...vocabForSecteur(ctx.secteur), ...vocabForSousSecteur(ctx.sousSecteur), ...(ctx.extraKeywords ?? [])]
    .map(k => k.toLowerCase().trim())
    .filter(Boolean)

  return exemples
    .map((ex, idx) => ({ ex, idx, score: scoreExemple(ex, keywords) }))
    .sort((a, b) => (b.score - a.score) || (a.idx - b.idx)) // tri stable
    .map(({ ex, score }) => ({ ...ex, pertinent: score > 0 }))
}
