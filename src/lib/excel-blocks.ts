/**
 * excel-blocks.ts — Lectures non tabulaires d'une feuille (lot I2, B-IMP-14 / 15). Module PUR (entrée : lignes de texte,
 * cellules fusionnées déjà réduites à leur cellule maîtresse).
 *  - îlots : plusieurs mini-tableaux côte à côte, séparés par des colonnes vides ;
 *  - blocs clé/valeur : page de garde (libellé, puis valeurs) ;
 *  - blocs de texte : un titre court puis un paragraphe (périmètre, contexte).
 */

export interface TableIsland { firstColumn: number; lastColumn: number; title: string }

/** Îlots de colonnes contiguës ; le titre est la première cellule renseignée de l'îlot. */
export function detectTableIslands(rows: string[][]): TableIsland[] {
  const width = Math.max(0, ...rows.map(r => r.length))
  const used = Array.from({ length: width }, (_, c) => rows.some(r => (r[c] ?? '').trim() !== ''))
  const islands: TableIsland[] = []
  let start = -1
  for (let c = 0; c <= width; c++) {
    if (used[c]) { if (start < 0) start = c; continue }
    if (start >= 0) {
      const last = c - 1
      const title = rows.map(r => r.slice(start, last + 1).find(v => v.trim()) ?? '').find(Boolean) ?? ''
      islands.push({ firstColumn: start, lastColumn: last, title: title.trim() })
      start = -1
    }
  }
  return islands
}

export interface KeyValue { key: string; values: string[]; row: number; column: number }
const KEY_MAX = 60

/**
 * Lignes « libellé | valeur(s) » : le libellé est la première cellule courte d'une ligne comptant au moins une autre
 * cellule à sa droite OU d'un libellé suivi de cellules vides dans une zone où d'autres lignes ont des valeurs.
 * Une ligne réduite à un seul libellé isolé (titre de section, titre de feuille) est ignorée si aucune ligne voisine
 * n'a la même colonne pour libellé. Les positions (row, column) sont 1-basées.
 */
export function extractKeyValueBlocks(rows: string[][]): KeyValue[] {
  const withValues = rows.map((r, i) => {
    const cells = r.map((v, c) => ({ v: v.trim(), c })).filter(x => x.v)
    return { i, cells }
  })
  // Colonne de libellés : celle où se trouve le plus souvent la première cellule d'une ligne ayant des valeurs à droite.
  const counts = new Map<number, number>()
  for (const { cells } of withValues) if (cells.length >= 2 && cells[0].v.length <= KEY_MAX) counts.set(cells[0].c, (counts.get(cells[0].c) ?? 0) + 1)
  const keyColumn = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (keyColumn === undefined) return []
  const out: KeyValue[] = []
  let started = false
  for (const { i, cells } of withValues) {
    const first = cells[0]
    if (!first || first.c !== keyColumn || first.v.length > KEY_MAX) continue
    if (cells.length >= 2) { started = true; out.push({ key: first.v, values: cells.slice(1).map(x => x.v), row: i + 1, column: first.c + 1 }) }
    else if (started) out.push({ key: first.v, values: [], row: i + 1, column: first.c + 1 }) // libellé sans valeur, dans le bloc
  }
  return out
}

/** `row` : ligne (1-basée) du titre. */
export interface TextBlock { title: string; text: string; row: number }
const TITLE_MAX = 80
const PARAGRAPH_MIN = 40

/** Titre court (souvent terminé par « : ») suivi d'un paragraphe ; les autres lignes sont ignorées. */
export function extractTextBlocks(rows: string[][]): TextBlock[] {
  const cell = (r: string[] | undefined) => (r ?? []).map(v => v.trim()).filter(Boolean)
  const out: TextBlock[] = []
  for (let i = 0; i < rows.length; i++) {
    const t = cell(rows[i])
    if (t.length !== 1 || t[0].length > TITLE_MAX || !t[0].endsWith(':')) continue
    const body = cell(rows[i + 1])
    if (body.length === 1 && (body[0].length >= PARAGRAPH_MIN || !body[0].endsWith(':'))) out.push({ title: t[0].replace(/\s*:\s*$/, ''), text: body[0], row: i + 1 })
  }
  return out
}

// ─── Feuille « contexte » (périmètre en texte libre, page de garde) ──────────

export type ContextKind = 'TEXT' | 'KEYVALUE'
const COVER_NAME = /garde|cover|title page|page de titre|informations? (du )?projet/i

/** Une feuille sans tableau : titres + paragraphes (TEXT) ou page de garde libellé/valeur nommée comme telle (KEYVALUE). */
export function detectContextSheet(sheetName: string, rows: string[][]): ContextKind | null {
  if (extractTextBlocks(rows).length >= 2) return 'TEXT'
  if (COVER_NAME.test(sheetName) && extractKeyValueBlocks(rows).filter(x => x.values.length > 0).length >= 4) return 'KEYVALUE'
  return null
}

export interface ContextFromBlocks {
  context: { perimetre?: string; contexteJuridique?: string; architecture?: string; objectifs?: string }
  title?: string
  description?: string
}

const KEY_PROJECT = /^(nom (du )?projet|project name|projet)$/i
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Blocs de texte → cadrage (par mots des titres) ; clé/valeur → titre de l'analyse et propriétés du document (notes d'import, sans effet sur l'approbation). */
export function buildContextFromBlocks(blocks: { text: TextBlock[]; kv: KeyValue[] }): ContextFromBlocks {
  const ctx: ContextFromBlocks['context'] = {}
  const add = (key: 'perimetre' | 'contexteJuridique' | 'architecture' | 'objectifs', value: string) => { ctx[key] = ctx[key] ? `${ctx[key]}\n\n${value}` : value }
  for (const b of blocks.text) {
    const t = norm(b.title)
    if (/juridi|regl|legal|regulat|complian/.test(t)) add('contexteJuridique', b.text)
    else if (/architect/.test(t)) add('architecture', b.text)
    else if (/objectif|goal|objective/.test(t)) add('objectifs', b.text)
    else add('perimetre', b.text)
  }
  const out: ContextFromBlocks = { context: ctx }
  const title = blocks.kv.find(k => KEY_PROJECT.test(k.key.trim()) && k.values[0])?.values[0]
  if (title) out.title = title
  const lines = blocks.kv.filter(k => k.values.length > 0 && !KEY_PROJECT.test(k.key.trim())).map(k => `${k.key} : ${k.values.join(' — ')}`)
  if (lines.length) out.description = lines.join('\n').slice(0, 2000)
  return out
}
