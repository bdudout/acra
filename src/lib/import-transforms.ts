/**
 * import-transforms.ts — Transformations de cellules de l'import universel (lot I3). Module PUR.
 * Références à préfixe (VM_02 / VM02), listes et plages (R_01 à R_09), niveaux « 3 - Elevé », symboles « + + + »,
 * correspondance de valeurs, regroupement de lignes, retenu Oui/Non, lignes modèles vides.
 * Principe : rien n'est deviné — ce qui ne se résout pas est rendu explicitement (null / UNMAPPED / conflits).
 */

const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

// ─── Références ──────────────────────────────────────────────────────────────

/** Forme canonique : casse, séparateurs et zéros de tête ignorés (`VM_02` = `VM02` = `vm-02`). Le préfixe reste discriminant. */
export function canonicalRef(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(?<![0-9])0+(?=[0-9])/g, '')
}

export interface RefSpace { prefixes: string[] }
export interface ExtractedRef { ref: string; raw: string; expandedFrom?: string }

const MAX_RANGE = 200
const RANGE_CONNECTOR = /^\s*(?:à|a|au|to|until|jusqu['’]?à|-|–|—)\s*$/i

interface Hit { start: number; end: number; raw: string; prefix: string; digits: string; suffix: string }

function findHits(text: string, space: RefSpace): Hit[] {
  const prefixes = [...space.prefixes].sort((a, b) => b.length - a.length).map(escapeRe)
  if (!prefixes.length) return []
  const re = new RegExp(`(?<![A-Za-z0-9])(${prefixes.join('|')})[ _.\\-/]?(\\d{1,4})([A-Za-z](?![A-Za-z0-9]))?(?![0-9])`, 'gi')
  const hits: Hit[] = []
  for (const m of text.matchAll(re)) hits.push({ start: m.index!, end: m.index! + m[0].length, raw: m[0], prefix: m[1].toUpperCase(), digits: m[2], suffix: m[3] ?? '' })
  return hits
}

/** Toutes les références de l'espace déclaré dans une cellule, plages développées, sans doublon, dans l'ordre. */
export function extractReferences(text: string, space: RefSpace): ExtractedRef[] {
  const hits = findHits(text, space)
  const out: ExtractedRef[] = []
  const seen = new Set<string>()
  const push = (r: ExtractedRef) => { if (!seen.has(r.ref)) { seen.add(r.ref); out.push(r) } }
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]
    const next = hits[i + 1]
    const lo = Number(h.digits)
    const hi = next ? Number(next.digits) : NaN
    const isRange = next && !h.suffix && !next.suffix && h.prefix === next.prefix && RANGE_CONNECTOR.test(text.slice(h.end, next.start)) && hi > lo && hi - lo <= MAX_RANGE
    if (isRange) {
      const from = text.slice(h.start, next.end)
      const lead = h.raw.slice(0, h.raw.length - h.digits.length)
      for (let n = lo; n <= hi; n++) push({ ref: canonicalRef(`${h.prefix}${n}`), raw: n === lo ? h.raw : n === hi ? next.raw : `${lead}${String(n).padStart(h.digits.length, '0')}`, expandedFrom: from })
      i++ // la borne haute est consommée
      continue
    }
    push({ ref: canonicalRef(h.raw), raw: h.raw })
  }
  return out
}

/** « ER03 : libellé ER_07: libellé » → références avec leur libellé libre (contrôle de cohérence, la référence fait foi). */
export function extractReferencesWithLabels(text: string, space: RefSpace): { ref: string; raw: string; label: string }[] {
  const hits = findHits(text, space)
  return hits.map((h, i) => {
    const rest = text.slice(h.end, hits[i + 1]?.start ?? text.length)
    return { ref: canonicalRef(h.raw), raw: h.raw, label: rest.replace(/^[\s:\-–—]+/, '').replace(/[\s,;]+$/, '') }
  })
}

/** Alias de préfixe VALIDÉ par l'utilisateur (`R_` ⇒ `RI_`) : jamais appliqué automatiquement. */
export function aliasPrefix(ref: string, aliases: Record<string, string>): string {
  const m = /^([A-Za-z]+)([ _.\-/]?\d.*)$/.exec(ref.trim())
  if (!m) return ref
  const target = aliases[m[1].toUpperCase()]
  return target ? `${target}${m[2]}` : ref
}

// ─── Niveaux ─────────────────────────────────────────────────────────────────

/** « 3 - Elevé » → { level: 3, label: 'Elevé' } ; « 4 » → { level: 4, label: '' } ; sinon null. */
export function parseLevelLabel(value: string): { level: number; label: string } | null {
  const m = /^\s*(\d)\s*(?:[-–—:.)]\s*(.+?))?\s*$/.exec(value)
  return m ? { level: Number(m[1]), label: m[2] ?? '' } : null
}

/** « + + + » → 3, à condition que l'échelle déclarée admette ce nombre de symboles. */
export function parseSymbolLevel(value: string, max: number): number | null {
  const t = value.trim()
  if (!t || !/^[+\s]+$/.test(t)) return null
  const n = (t.match(/\+/g) ?? []).length
  return n >= 1 && n <= max ? n : null
}

// ─── Correspondance de valeurs ───────────────────────────────────────────────

export type ValueDictionary = 'sourceCategory' | 'measureStatus' | 'treatment' | 'retained' | 'stakeholderType'
const DICTIONARIES: Record<ValueDictionary, Record<string, string>> = {
  sourceCategory: {
    'etat': 'ETAT_NATION', 'etat nation': 'ETAT_NATION', 'crime organise': 'CYBERCRIMINEL', 'cybercriminel': 'CYBERCRIMINEL', 'terroriste': 'TERRORISTE',
    'acteur prive': 'CONCURRENT', 'concurrent': 'CONCURRENT', 'activiste': 'ACTIVISTE', 'amateur': 'AMATEUR', 'vengeur': 'EMPLOYE_MALVEILLANT', 'malveillant interne': 'EMPLOYE_MALVEILLANT', 'prestataire': 'PRESTATAIRE',
  },
  measureStatus: {
    'termine': 'REALISE', 'realise': 'REALISE', 'fait': 'REALISE', 'done': 'REALISE', 'a realiser': 'A_FAIRE', 'a faire': 'A_FAIRE', 'planifie': 'A_FAIRE', 'todo': 'A_FAIRE',
    'en cours': 'EN_COURS', 'in progress': 'EN_COURS', 'abandonne': 'REPORTE', 'suspendu': 'REPORTE', 'reporte': 'REPORTE',
  },
  treatment: {
    'reduction': 'REDUIRE', 'reduire': 'REDUIRE', 'partage': 'TRANSFERER', 'transfert': 'TRANSFERER', 'transferer': 'TRANSFERER', 'acceptation': 'ACCEPTER', 'accepter': 'ACCEPTER',
    'evitement': 'REFUSER', 'eviter': 'REFUSER', 'refus': 'REFUSER', 'refuser': 'REFUSER', 'surveiller': 'SURVEILLER',
  },
  stakeholderType: { 'fournisseur': 'FOURNISSEUR', 'client': 'CLIENT', 'partenaire': 'PARTENAIRE', 'prestataire': 'PRESTATAIRE', 'regulateur': 'ORGANISME_REGULATION', 'organisme': 'ORGANISME_REGULATION' },
  retained: { 'oui': 'YES', 'yes': 'YES', 'non': 'NO', 'no': 'NO', 'peut etre': 'MAYBE', 'maybe': 'MAYBE' },
}

function lookupDictionary(value: string, dict: Record<string, string>): string | null {
  const v = strip(value)
  if (!v) return null
  if (dict[v]) return dict[v]
  const key = Object.keys(dict).sort((a, b) => b.length - a.length).find(k => v.startsWith(`${k} `))
  return key ? dict[key] : null
}

/** Table proposée valeur source → valeur ACRA ; `null` = à confirmer par l'utilisateur (jamais deviné). */
export function suggestValueMap(values: string[], dictionary: ValueDictionary): Record<string, string | null> {
  const dict = DICTIONARIES[dictionary]
  return Object.fromEntries(values.map(v => [v, lookupDictionary(v, dict)]))
}

export type ValueMapResult = { value: string | null; status: 'MAPPED' | 'UNMAPPED' | 'DEFAULTED' | 'EMPTY' }

/** Applique une table validée (insensible casse / accents) ; `fallback` (ex. AUTRE) seulement s'il est demandé, et signalé. */
export function applyValueMap(value: string, table: Record<string, string | null | undefined>, opts: { fallback?: string } = {}): ValueMapResult {
  const v = strip(value)
  if (!v) return { value: null, status: 'EMPTY' }
  const hit = Object.entries(table).find(([k, t]) => strip(k) === v && t)
  if (hit) return { value: hit[1] as string, status: 'MAPPED' }
  return opts.fallback ? { value: opts.fallback, status: 'DEFAULTED' } : { value: null, status: 'UNMAPPED' }
}

// ─── Retenu, lignes modèles, regroupement ────────────────────────────────────

export type Retained = 'YES' | 'NO' | 'MAYBE'
export function normalizeRetained(value: string): Retained | null {
  const r = lookupDictionary(value, DICTIONARIES.retained)
  return r === 'YES' || r === 'NO' || r === 'MAYBE' ? r : null
}

export type RetainedMode = 'ONLY_RETAINED' | 'RETAINED_AND_MAYBE' | 'ALL'
export function filterRetained<T extends Record<string, string>>(rows: T[], column: string, mode: RetainedMode): T[] {
  if (mode === 'ALL') return rows
  return rows.filter(r => { const s = normalizeRetained(r[column] ?? ''); return s === 'YES' || (mode === 'RETAINED_AND_MAYBE' && s === 'MAYBE') })
}

/** Ligne modèle : seule la colonne de référence est renseignée (VM_07…VM_10, SS-09). */
export function isTemplateRow(row: Record<string, string>, refColumn: string): boolean {
  const filled = Object.entries(row).filter(([, v]) => (v ?? '').trim() !== '')
  return filled.length === 1 && filled[0][0] === refColumn
}

export interface RowGroup<T> { key: string; parent: Record<string, string>; rows: T[]; conflicts: { column: string; values: string[] }[] }

/** N lignes → 1 parent (clé + colonnes propres au parent) et ses enfants ; les divergences du parent sont rapportées. */
export function groupRows<T extends Record<string, string>>(rows: T[], keyColumn: string, parentColumns: string[]): RowGroup<T>[] {
  const groups: RowGroup<T>[] = []
  const byKey = new Map<string, RowGroup<T>>()
  for (const row of rows) {
    const key = (row[keyColumn] ?? '').trim()
    // Clé de regroupement insensible à la casse, aux accents et à la ponctuation (« Crime organisé » = « Crime Organisé »).
    const norm = strip(key)
    let g = norm ? byKey.get(norm) : undefined
    if (!g) {
      g = { key, parent: { [keyColumn]: key }, rows: [], conflicts: [] }
      groups.push(g)
      if (norm) byKey.set(norm, g)
    }
    g.rows.push(row)
  }
  for (const g of groups) {
    for (const column of parentColumns) {
      const distinct = [...new Set(g.rows.map(r => (r[column] ?? '').trim()).filter(Boolean))]
      if (distinct[0] !== undefined) g.parent[column] = distinct[0]
      if (distinct.length > 1) g.conflicts.push({ column, values: distinct })
    }
  }
  return groups
}

/** Préfixes alphabétiques d'une liste de références (`RI_01` → `RI`, `SR/OV_02` → `SR/OV`). */
export function prefixesOfRefs(refs: string[]): string[] {
  return [...new Set(refs.flatMap(r => { const m = /^([A-Za-z][A-Za-z/]*)[ _.\-]?\d/.exec(r.trim()); return m ? [m[1].toUpperCase()] : [] }))]
}

/**
 * Alias de préfixe PROPOSÉ (à valider par l'utilisateur) : les références citées utilisent un préfixe qui n'existe pas côté
 * cible (`R_` dans les mesures, `RI_` dans les risques). Une proposition n'existe que s'il y a un unique préfixe cible voisin
 * (commençant par le préfixe cité) ; sinon rien n'est proposé.
 */
export function suggestPrefixAlias(citedCells: string[], targetRefs: string[]): { from: string; to: string }[] {
  const targets = prefixesOfRefs(targetRefs)
  const cited = new Set<string>()
  for (const cell of citedCells) for (const m of cell.matchAll(/(?<![A-Za-z0-9])([A-Za-z][A-Za-z/]{0,5})[ _.\-]?\d{1,4}(?![0-9A-Za-z])/g)) cited.add(m[1].toUpperCase())
  const out: { from: string; to: string }[] = []
  for (const from of cited) {
    if (targets.includes(from)) continue
    const candidates = targets.filter(t => t.startsWith(from))
    if (candidates.length === 1) out.push({ from, to: candidates[0] })
  }
  return out
}
