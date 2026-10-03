/**
 * sous-secteurs.ts — Taxonomie des sous-secteurs (issue #25).
 *
 * Le secteur d'une analyse est stocké sous son libellé LOCALISÉ ; on rattache donc
 * un secteur à une « famille » par mots-clés multilingues (même approche que
 * `baseFrameworksForSector`). La famille permet de proposer les sous-secteurs
 * pertinents (cf. SOUS_SECTEURS dans ebios-data.ts) et d'affiner la guidance.
 *
 * Module pur → testé (sous-secteurs.test.ts).
 */
import { SOUS_SECTEURS } from '@/lib/ebios-data'

/** Famille de secteur d'activité (santé, banque, défense, énergie…) regroupant les sous-secteurs. */
export type SecteurFamille = 'sante' | 'banque' | 'defense' | 'energie' | 'administration' | 'industrie' | 'juridique' | 'transport' | 'immobilier' | 'technique' | 'protection_sociale'

// Mots-clés (minuscules, sous-chaînes) par famille — ordre = priorité de résolution.
const FAMILY_KEYWORDS: { famille: SecteurFamille; kw: string[] }[] = [
  // En tête : « Interconnessione » (it) contient des sous-chaînes d'autres familles.
  { famille: 'technique', kw: ['technique', 'interconnexion', 'interconnection', 'technical', 'technik', 'kopplung', 'técnico', 'tecnico', 'interconexión', 'interconexion', 'interconnessione'] },
  // Avant santé et banque : « Sozialversicherung » contient « versicherung », « assurance maladie » contient « assur ».
  { famille: 'protection_sociale', kw: ['protection sociale', 'sécurité sociale', 'securite sociale', 'social protection', 'social security', 'sozialschutz', 'sozialversicherung', 'protección social', 'proteccion social', 'seguridad social', 'protezione sociale', 'previdenza sociale'] },
  { famille: 'sante', kw: ['santé', 'sante', 'médico', 'medico', 'hospital', 'soin', 'health', 'salud', 'gesundheit', 'sanità', 'sanita'] },
  { famille: 'banque', kw: ['banque', 'bancaire', 'finance', 'financ', 'assur', 'fintech', 'bank', 'insurance', 'versicherung', 'seguro', 'assicura'] },
  { famille: 'defense', kw: ['défense', 'defense', 'défence', 'defence', 'militaire', 'verteidigung', 'defensa', 'difesa', 'national'] },
  { famille: 'energie', kw: ['énergie', 'energie', 'utilities', 'energy', 'energía', 'energia'] },
  { famille: 'administration', kw: ['administration', 'public', 'collectivit', 'gouvernement', 'government', 'verwaltung', 'amministrazione', 'état', 'etat'] },
  { famille: 'industrie', kw: ['industrie', 'manufactur', 'usine', 'scada', 'industry', 'industria', 'industrie '] },
  { famille: 'juridique', kw: ['juridique', 'avocat', 'notaire', 'juriste', 'barreau', 'legal', 'law', 'notar', 'abogado', 'anwalt'] },
  { famille: 'transport', kw: ['transport', 'logistique', 'logistics', 'fret', 'ferroviaire', 'aérien', 'aerien', 'maritime', 'livraison', 'transporte', 'trasporto', 'verkehr'] },
  { famille: 'immobilier', kw: ['immobilier', 'construction', 'bâtiment', 'batiment', 'btp', 'promoteur', 'real estate', 'foncier', 'inmobili', 'immobili', 'bau'] },
]

/** Famille d'un secteur (par mots-clés multilingues), ou null si aucune taxonomie. */
export function secteurFamily(secteur?: string | null): SecteurFamille | null {
  const s = (secteur ?? '').toLowerCase()
  if (!s) return null
  for (const { famille, kw } of FAMILY_KEYWORDS) {
    if (kw.some(k => s.includes(k))) return famille
  }
  return null
}

/** Ids de sous-secteurs proposés pour ce secteur (vide si aucune taxonomie). */
export function sousSecteurIdsFor(secteur?: string | null): string[] {
  const fam = secteurFamily(secteur)
  if (!fam) return []
  return SOUS_SECTEURS.filter(s => s.famille === fam).map(s => s.id)
}

/** Vrai si le sous-secteur appartient bien à la famille du secteur (cohérence). */
export function isSousSecteurOfSecteur(secteur?: string | null, sousSecteur?: string | null): boolean {
  if (!sousSecteur) return false
  return sousSecteurIdsFor(secteur).includes(sousSecteur)
}

// Sous-secteurs santé qui hébergent réellement les données (cibles directes HDS) :
// la mise en garde « HDS = auto-hébergement, préférez ISO 27001 » ne doit PAS leur
// être affichée (issue #78).
const HDS_SELF_HOSTING = new Set(['sante-hopital', 'sante-ehpad'])

/** Faut-il afficher la mise en garde HDS ? Non pour les hébergeurs (CHU/EHPAD). */
export function showsHdsCaveat(sousSecteur?: string | null): boolean {
  return !HDS_SELF_HOSTING.has(sousSecteur ?? '')
}

// ─── Plusieurs sous-secteurs par analyse ──────────────────────────────────────
// Une analyse peut combiner jusqu'à MAX_SOUS_SECTEURS sous-secteurs (ex. complémentaire santé + interconnexion avec un
// prestataire). Règle de cohérence : seuls les sous-secteurs de la famille du secteur sont proposés, plus ceux de la
// catégorie « technique » (interconnexions, transverses à tous les métiers) ; jamais ceux d'un autre secteur.
// Le premier sous-secteur est le principal (repris dans `Analyse.sousSecteur` pour les usages à valeur unique).

export const MAX_SOUS_SECTEURS = 4

/** Ids proposables pour ce secteur : sa famille, puis les interconnexions (technique). Vide sans secteur. */
export function selectableSousSecteurIds(secteur?: string | null): string[] {
  if (!(secteur ?? '').trim()) return []
  const fam = secteurFamily(secteur)
  const technique = SOUS_SECTEURS.filter(s => s.famille === 'technique').map(s => s.id)
  if (fam === 'technique') return technique
  return [...sousSecteurIdsFor(secteur), ...technique]
}

/** Sélection assainie : ids cohérents avec le secteur, sans doublon, ordre conservé, plafonnée. */
export function normalizeSousSecteurs(secteur: string | null | undefined, input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const allowed = new Set(selectableSousSecteurIds(secteur))
  const out: string[] = []
  for (const v of input) {
    if (typeof v === 'string' && allowed.has(v) && !out.includes(v)) out.push(v)
    if (out.length >= MAX_SOUS_SECTEURS) break
  }
  return out
}

/** Sous-secteurs d'une analyse : la liste si renseignée, sinon l'ancien champ unique. */
export function sousSecteursOf(a: { sousSecteurs?: unknown; sousSecteur?: string | null } | null | undefined): string[] {
  if (!a) return []
  // Colonne JSON : on ne garde que des chaînes.
  const list = Array.isArray(a.sousSecteurs) ? a.sousSecteurs.filter((x): x is string => typeof x === 'string' && x !== '') : []
  if (list.length) return list
  return a.sousSecteur ? [a.sousSecteur] : []
}

/**
 * Valeurs à enregistrer à la création / modification d'une analyse. `input.sousSecteurs` (liste) est prioritaire ;
 * à défaut `input.sousSecteur` (ancien champ unique) ; à défaut les valeurs existantes, re-validées contre le secteur
 * effectif (un changement de secteur retire ce qui devient incohérent).
 */
export function resolveSousSecteursUpdate(a: {
  secteur: string | null | undefined
  input: { sousSecteurs?: unknown; sousSecteur?: unknown }
  existing?: { sousSecteurs?: unknown; sousSecteur?: string | null } | null
}): { sousSecteurs: string[]; sousSecteur: string | null } {
  const raw = 'sousSecteurs' in a.input && a.input.sousSecteurs !== undefined
    ? a.input.sousSecteurs
    : 'sousSecteur' in a.input && a.input.sousSecteur !== undefined
      ? (a.input.sousSecteur ? [a.input.sousSecteur] : [])
      : sousSecteursOf(a.existing)
  const sousSecteurs = normalizeSousSecteurs(a.secteur, raw)
  return { sousSecteurs, sousSecteur: sousSecteurs[0] ?? null }
}
