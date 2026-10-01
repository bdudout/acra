// ─── Import guidé de processus (CSV / XLSX) — moteur d'aperçu PUR ─────────────────────────────────────────────────────────
// Chaque ligne reçoit un statut expliqué : prête / déjà importée / doublon possible (à confirmer) / rejetée (raison). Les lignes
// valides restent importables. Rien n'est jamais fusionné : un nom identique n'est qu'un doublon POSSIBLE, à confirmer.
// La référence de la ligne (colonne « Réf. ») sert de clé d'origine stable : réimporter le même fichier ne recrée rien et
// ne modifie ni les liens ni les noms déjà saisis dans ACRA.

export const MAX_PROCESS_NAME = 200
export const MAX_PROCESS_ROWS = 500

export interface ProcessusImportRow { line: number; nom: string; ref?: string; parent?: string; description?: string; proprietaire?: string }
export interface ExistingProcessus { id: string; nom: string; parentId: string | null; importKey: string | null }

export type ProcessusLineStatus = 'READY' | 'ALREADY_IMPORTED' | 'POSSIBLE_DUPLICATE' | 'REJECTED'
export type ProcessusRejectReason = 'missing_name' | 'name_too_long' | 'duplicate_ref' | 'unknown_parent' | 'ambiguous_parent' | 'self_parent' | 'cycle' | 'parent_rejected'

export interface PlannedProcessusLine {
  line: number; status: ProcessusLineStatus; reason?: ProcessusRejectReason
  nom: string; ref?: string; key?: string; description?: string; proprietaire?: string
  /** Parent dans le fichier (numéro de ligne) ou processus existant (id) ; absent = racine. */
  parentLine?: number; parentExistingId?: string
  /** Doublon possible : ligne du fichier ou processus existant concerné. */
  duplicateOfLine?: number; duplicateOfId?: string
}
export interface ProcessusImportPlan {
  lines: PlannedProcessusLine[]
  /** Lignes à créer, parents avant enfants. */
  toCreate: PlannedProcessusLine[]
  counts: { ready: number; alreadyImported: number; possibleDuplicate: number; rejected: number }
}

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const norm = (s: string) => strip(s).replace(/[^a-z0-9]+/g, ' ').trim()
const refNorm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ')
const keyOf = (ref: string) => `import:${refNorm(ref)}`

const REF_HEADERS = new Set(['ref', 'reference', 'code', 'id', 'identifiant', 'numero', 'n', 'no'])
const NAME_HEADERS = new Set(['nom', 'name', 'processus', 'process', 'intitule', 'libelle', 'titre', 'title', 'nom du processus', 'process name'])
const DESC_HEADERS = new Set(['description', 'desc', 'details', 'detail'])
const OWNER_HEADERS = new Set(['proprietaire', 'responsable', 'owner', 'porteur', 'process owner'])

/** Associe les en-têtes d'un fichier aux champs (une colonne ne sert qu'un champ ; « processus parent » n'est pas le nom). */
export function mapProcessusColumns(headers: string[]): { ref?: string; parent?: string; nom?: string; description?: string; proprietaire?: string } {
  const out: { ref?: string; parent?: string; nom?: string; description?: string; proprietaire?: string } = {}
  const used = new Set<string>()
  const take = (field: keyof typeof out, test: (h: string) => boolean) => {
    const found = headers.find(h => !used.has(h) && test(norm(h)))
    if (found) { out[field] = found; used.add(found) }
  }
  take('parent', h => h.includes('parent'))
  take('ref', h => REF_HEADERS.has(h) || /^(ref|reference|code|id)( |$)/.test(h))
  take('nom', h => NAME_HEADERS.has(h))
  take('description', h => DESC_HEADERS.has(h))
  take('proprietaire', h => OWNER_HEADERS.has(h))
  return out
}

/** Aperçu ligne à ligne d'un import de processus, sans écriture. `createAnyway` : lignes de doublon possible confirmées. */
export function planProcessusImport(rows: ProcessusImportRow[], existing: ExistingProcessus[], opts: { createAnyway?: number[] } = {}): ProcessusImportPlan {
  const createAnyway = new Set(opts.createAnyway ?? [])
  const lines = new Map<number, PlannedProcessusLine>()
  const byLine = new Map(rows.map(r => [r.line, r]))
  const reject = (line: number, reason: ProcessusRejectReason) => { const l = lines.get(line)!; l.status = 'REJECTED'; l.reason = reason }

  // 1. Validité de base, clés, doublons de référence dans le fichier.
  const fileByRef = new Map<string, number>()
  for (const r of rows) {
    const nom = (r.nom ?? '').trim(); const ref = r.ref?.trim() || undefined
    const l: PlannedProcessusLine = { line: r.line, status: 'READY', nom, ...(ref ? { ref, key: keyOf(ref) } : {}), ...(r.description?.trim() ? { description: r.description.trim() } : {}), ...(r.proprietaire?.trim() ? { proprietaire: r.proprietaire.trim() } : {}) }
    lines.set(r.line, l)
    if (!nom) { reject(r.line, 'missing_name'); continue }
    if (nom.length > MAX_PROCESS_NAME) { reject(r.line, 'name_too_long'); continue }
    if (ref) {
      if (fileByRef.has(refNorm(ref))) { reject(r.line, 'duplicate_ref'); continue }
      fileByRef.set(refNorm(ref), r.line)
    }
  }
  const validLines = rows.filter(r => lines.get(r.line)!.status !== 'REJECTED').map(r => r.line)
  const fileByName = new Map<string, number[]>()
  for (const line of validLines) { const k = norm(lines.get(line)!.nom); fileByName.set(k, [...(fileByName.get(k) ?? []), line]) }
  const existingByKey = new Map(existing.filter(e => e.importKey).map(e => [e.importKey!, e]))
  const existingByName = new Map<string, ExistingProcessus[]>()
  for (const e of existing) { const k = norm(e.nom); existingByName.set(k, [...(existingByName.get(k) ?? []), e]) }

  // 2. Déjà importées (même référence) : jamais recréées, jamais modifiées.
  for (const line of validLines) { const l = lines.get(line)!; if (l.key && existingByKey.has(l.key)) l.status = 'ALREADY_IMPORTED' }

  // 3. Résolution des parents (référence du fichier, nom dans le fichier, processus existant par clé puis par nom).
  const parentRow = new Map<number, number>() // ligne → ligne parent (dans le fichier)
  for (const line of validLines) {
    const l = lines.get(line)!; if (l.status === 'ALREADY_IMPORTED') continue
    const value = (byLine.get(line)!.parent ?? '').trim(); if (!value) continue
    const byRef = fileByRef.get(refNorm(value))
    if (byRef !== undefined) { if (byRef === line) { reject(line, 'self_parent'); continue } parentRow.set(line, byRef); continue }
    const inFile = fileByName.get(norm(value)) ?? []
    if (inFile.length > 1) { reject(line, 'ambiguous_parent'); continue }
    if (inFile.length === 1) { if (inFile[0] === line) { reject(line, 'self_parent'); continue } parentRow.set(line, inFile[0]); continue }
    const byKey = existingByKey.get(keyOf(value))
    if (byKey) { l.parentExistingId = byKey.id; continue }
    const named = existingByName.get(norm(value)) ?? []
    if (named.length > 1) { reject(line, 'ambiguous_parent'); continue }
    if (named.length === 1) { l.parentExistingId = named[0].id; continue }
    reject(line, 'unknown_parent')
  }

  // 4. Cycles dans le fichier : toutes les lignes du cycle sont rejetées.
  for (const start of parentRow.keys()) {
    if (lines.get(start)!.status === 'REJECTED') continue
    const path: number[] = []; let cur: number | undefined = start
    while (cur !== undefined && !path.includes(cur)) { path.push(cur); cur = parentRow.get(cur) }
    if (cur !== undefined) for (const inCycle of path.slice(path.indexOf(cur))) if (lines.get(inCycle)!.status !== 'REJECTED') reject(inCycle, 'cycle')
  }

  // 5. Propagation : un enfant dont le parent (dans le fichier) est rejeté est rejeté.
  let changed = true
  while (changed) {
    changed = false
    for (const [line, parent] of parentRow) {
      if (lines.get(line)!.status !== 'REJECTED' && lines.get(parent)!.status === 'REJECTED') { reject(line, 'parent_rejected'); changed = true }
    }
  }

  // 6. Liens vers le fichier (parent déjà importé → processus existant), puis doublons possibles.
  for (const [line, parent] of parentRow) {
    const l = lines.get(line)!; if (l.status === 'REJECTED') continue
    const p = lines.get(parent)!
    if (p.status === 'ALREADY_IMPORTED') l.parentExistingId = existingByKey.get(p.key!)!.id
    else l.parentLine = parent
  }
  const seen = new Map<string, number>() // « parent|nom » → 1re ligne du fichier
  for (const line of validLines) {
    const l = lines.get(line)!; if (l.status !== 'READY') continue
    const parentId = l.parentExistingId ?? null
    const clash = !l.parentLine ? (existingByName.get(norm(l.nom)) ?? []).find(e => e.parentId === parentId) : undefined
    const groupKey = `${l.parentLine ?? parentId ?? ''}|${norm(l.nom)}`
    const first = seen.get(groupKey)
    if (!createAnyway.has(line)) {
      if (clash) { l.status = 'POSSIBLE_DUPLICATE'; l.duplicateOfId = clash.id; seen.set(groupKey, first ?? line); continue }
      if (first !== undefined && (!l.ref || !lines.get(first)!.ref)) { l.status = 'POSSIBLE_DUPLICATE'; l.duplicateOfLine = first; continue }
    }
    if (first === undefined) seen.set(groupKey, line)
  }
  // Un enfant d'une ligne « doublon possible » non confirmée n'est pas créé sans son parent.
  changed = true
  while (changed) {
    changed = false
    for (const [line, parent] of parentRow) {
      const l = lines.get(line)!; const p = lines.get(parent)!
      if (l.status === 'READY' && (p.status === 'POSSIBLE_DUPLICATE')) { reject(line, 'parent_rejected'); changed = true }
    }
  }

  // 7. Ordre de création : parents avant enfants.
  const depth = (line: number): number => { let d = 0; let cur = parentRow.get(line); while (cur !== undefined && d < 1000) { d += 1; cur = parentRow.get(cur) } return d }
  const all = rows.map(r => lines.get(r.line)!)
  const toCreate = all.filter(l => l.status === 'READY').sort((a, b) => depth(a.line) - depth(b.line) || a.line - b.line)
  const count = (s: ProcessusLineStatus) => all.filter(l => l.status === s).length
  return { lines: all, toCreate, counts: { ready: count('READY'), alreadyImported: count('ALREADY_IMPORTED'), possibleDuplicate: count('POSSIBLE_DUPLICATE'), rejected: count('REJECTED') } }
}
