// ─── JSON de forme libre → classeur en mémoire (lot I7, B-IMP-70) ────────────
// Chaque tableau d'objets devient une feuille (colonnes = chemins relatifs aplatis) ; un tableau imbriqué devient une
// feuille enfant dont la 1re colonne porte l'identifiant du parent. Aucune exécution, aucune `$ref` suivie, tout borné.

import ExcelJS from 'exceljs'

const MAX_DEPTH = 12
const MAX_SHEETS = 20
const MAX_NODES = 200_000
const MAX_COLUMNS = 60
const MAX_ROWS = 20_000
const ID_KEYS = ['id', 'ref', 'reference', 'référence', 'code', 'key', 'uid']

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const isTable = (v: unknown): v is Obj[] => Array.isArray(v) && v.length > 0 && v.every(isObj)
const scalar = (v: unknown) => (v == null ? '' : typeof v === 'object' ? '' : String(v))

interface Table { name: string; header: string[]; rows: string[][] }

function flatten(row: Obj, prefix: string, out: Map<string, string>, depth: number) {
  for (const key of Object.keys(row)) {
    const value = row[key]
    const path = prefix ? `${prefix}.${key}` : key
    if (isObj(value)) { if (depth < MAX_DEPTH) flatten(value, path, out, depth + 1) }
    else if (Array.isArray(value)) { if (!isTable(value)) out.set(path, value.map(scalar).filter(Boolean).join('; ')) }
    else out.set(path, scalar(value))
  }
}

function parentId(row: Obj): string {
  for (const key of ID_KEYS) { const v = row[key]; if (v != null && typeof v !== 'object' && String(v) !== '') return String(v) }
  const first = Object.values(row).find(v => v != null && typeof v !== 'object')
  return first == null ? '' : String(first)
}

function sheetName(raw: string, used: Set<string>): string {
  const base = raw.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Feuille'
  let name = base; let n = 2
  while (used.has(name.toLowerCase())) { const suffix = ` ${n++}`; name = base.slice(0, 31 - suffix.length) + suffix }
  used.add(name.toLowerCase()); return name
}

export function jsonToWorkbook(buffer: Buffer, filename: string): ExcelJS.Workbook {
  const root: unknown = JSON.parse(buffer.toString('utf8').replace(/^﻿/, ''))
  const baseName = filename.replace(/\.[A-Za-z0-9]+$/, '')
  const tables: Table[] = []
  let nodes = 0

  const addTable = (path: string, items: Obj[], parentName?: string, parentIds?: string[]) => {
    if (tables.length >= MAX_SHEETS) return
    const cols = new Map<string, true>()
    const flat = items.slice(0, MAX_ROWS).map(item => { const m = new Map<string, string>(); flatten(item, '', m, 0); m.forEach((_, k) => { if (cols.size < MAX_COLUMNS) cols.set(k, true) }); return m })
    const keys = [...cols.keys()]
    const header = parentName ? [parentName, ...keys] : keys
    const rows = flat.map((m, i) => (parentName ? [parentIds?.[i] ?? ''] : []).concat(keys.map(k => m.get(k) ?? '')))
    const name = path || baseName
    tables.push({ name, header, rows })
    // tableaux d'objets imbriqués : une feuille enfant (lignes de tous les parents concaténées)
    const children = new Map<string, { items: Obj[]; ids: string[] }>()
    items.slice(0, MAX_ROWS).forEach(item => {
      for (const key of Object.keys(item)) {
        const value = item[key]
        if (isTable(value)) { const c = children.get(key) ?? { items: [], ids: [] }; value.forEach(v => { c.items.push(v); c.ids.push(parentId(item)) }); children.set(key, c) }
      }
    })
    children.forEach((c, key) => addTable(`${path || baseName}.${key}`, c.items, path || baseName, c.ids))
  }

  const walk = (value: unknown, path: string, depth: number) => {
    if (depth > MAX_DEPTH || ++nodes > MAX_NODES) return
    if (isTable(value)) { addTable(path, value); return }
    if (isObj(value)) for (const key of Object.keys(value)) walk(value[key], path ? `${path}.${key}` : key, depth + 1)
  }
  walk(root, '', 0)

  const props: string[][] = isObj(root) ? Object.keys(root).filter(k => root[k] != null && typeof root[k] !== 'object').map(k => [k, String(root[k])]) : []
  const wb = new ExcelJS.Workbook()
  const used = new Set<string>()
  const sheets: Table[] = [...(props.length ? [{ name: 'Propriétés', header: ['Clé', 'Valeur'], rows: props }] : []), ...tables].slice(0, MAX_SHEETS)
  for (const t of sheets) {
    const ws = wb.addWorksheet(sheetName(t.name, used))
    const put = (r: number, cells: string[]) => cells.forEach((value, c) => { if (value !== '') { const cell = ws.getCell(r, c + 1); cell.value = value; cell.numFmt = '@' } })
    put(1, t.header); t.rows.forEach((cells, i) => put(i + 2, cells))
  }
  return wb
}
