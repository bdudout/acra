// ─── Catalogue canonique des cadres livrés + mapping nom → code ──────────────
// Pont d'UNIFICATION entre le côté « analyses de risques » (historiquement keyé par
// NOM : Cadrage.referentiels[].nom) et le côté « conformité / contrôles / audit »
// (keyé par CODE : referentielCode). Ce module résout un nom d'affichage vers le
// code canonique du cadre livré correspondant, pour que les deux mondes désignent
// le MÊME référentiel. Logique PURE et testée.

import { FRAMEWORK_IDS, FRAMEWORK_META, type FrameworkId } from './frameworks-data'
import { coerceDomaine, type Domaine } from './referentiel-domaines'
import { grcCodeFromNom } from './referentiels-builtins-grc'

export interface CatalogueEntry {
  code: FrameworkId
  nom: string
  domaine: Domaine
  version: string
}

/** Cadres livrés proposables (on exclut CUSTOM, emplacement d'exigences ad hoc). */
export function builtinCatalogue(): CatalogueEntry[] {
  return FRAMEWORK_IDS.filter(id => id !== 'CUSTOM').map(code => {
    const meta = FRAMEWORK_META[code]
    return { code, nom: meta.nom, domaine: coerceDomaine(meta.domaine), version: meta.version }
  })
}

// Normalise un nom pour comparaison : minuscules, sans accents, sans ponctuation ni
// numéro de version (« ISO/IEC 27001:2022 » ≈ « iso iec 27001 »). Le millésime en
// fin (":2022", " v8", " 2.0") est absorbé par la suppression de la ponctuation +
// la comparaison par préfixe côté alias.
function norm(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Alias métier explicites (nom d'affichage → code livré). Curatif plutôt que fuzzy :
// on préfère une table lisible et testée à une heuristique qui « devine ».
export const NOM_ALIAS_CODE: Record<string, FrameworkId> = {
  'iso iec 27001': 'ISO27001',
  'iso 27001': 'ISO27001',
  // NB : ISO/IEC 27002 est tenu DISTINCT de 27001 (décision produit) → pas d'alias,
  //      il résout à null (label/custom) tant qu'un cadre 27002 dédié n'est pas livré.
  'dora': 'DORA',
  'nist csf': 'NIST_CSF',
  'nist cybersecurity framework': 'NIST_CSF',
  'nist sp 800 53': 'NIST_800_53',
  'nist 800 53': 'NIST_800_53',
  'nist ssdf': 'NIST_SSDF',
  'cis controls': 'CIS_V8',
  'cis controls v8': 'CIS_V8',
  'cis v8': 'CIS_V8',
  'anssi guide d hygiene': 'ANSSI_HYG',
  'guide d hygiene': 'ANSSI_HYG',
  'hds': 'HDS',
  'pci dss': 'PCI_DSS',
  'soc 2': 'SOC2',
  'soc 2 type ii': 'SOC2',
  'rgs': 'RGS',
  'recyf': 'RECYF',
  'iec 62443': 'IEC_62443',
  'tisax': 'TISAX',
  'tisax vda isa': 'TISAX',
}

// Index normalisé des noms canoniques des cadres livrés (secours si absent des alias).
const BUILTIN_NORM_INDEX: Record<string, FrameworkId> = Object.fromEntries(
  FRAMEWORK_IDS.filter(id => id !== 'CUSTOM').map(id => [norm(FRAMEWORK_META[id].nom), id]),
)

/**
 * Résout un nom d'affichage de référentiel vers le CODE d'un cadre livré, ou `null`
 * si aucun ne correspond (le référentiel relève alors du custom / à seeder).
 * Absorbe le millésime : « ISO/IEC 27001:2022 » → ISO27001.
 */
export function referentielCodeFromNom(nom: unknown): FrameworkId | null {
  const n = norm(nom)
  if (!n) return null
  if (NOM_ALIAS_CODE[n]) return NOM_ALIAS_CODE[n]
  if (BUILTIN_NORM_INDEX[n]) return BUILTIN_NORM_INDEX[n]
  // Correspondance par préfixe : « iso iec 27001 2022 » commence par « iso iec 27001 ».
  for (const [alias, code] of Object.entries(NOM_ALIAS_CODE)) {
    if (n === alias || n.startsWith(alias + ' ')) return code
  }
  return null
}

/**
 * Point UNIQUE de résolution du code d'un référentiel sélectionné (config org ou
 * entrée d'analyse). Priorité au `code` explicite (nouvelles sélections) ; sinon
 * rétro-résolution par le nom (données historiques keyées par nom). `null` = label
 * sans cadre livré (custom / à seeder). Non destructif : aucune migration requise.
 */
export function resolveReferentielCode(entry: { code?: string | null; nom?: unknown } | null | undefined): string | null {
  if (!entry) return null
  const code = typeof entry.code === 'string' ? entry.code.trim() : ''
  if (code) return code
  // Cadre cyber livré, puis cadre GRC livré (RGPD, LCB-FT…), sinon null (custom/label).
  return referentielCodeFromNom(entry.nom) ?? grcCodeFromNom(entry.nom)
}
