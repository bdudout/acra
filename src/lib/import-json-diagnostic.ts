/**
 * import-json-diagnostic.ts — Diagnostic lisible d'un fichier JSON d'import (PUR).
 * Remplace « Fichier JSON invalide » par un code stable (traduit à l'affichage) + la localisation
 * (ligne, colonne, extrait) et la cause probable quand elle se reconnaît.
 */

export type JsonHint = 'trailing_comma' | 'single_quotes' | 'comments' | 'truncated'
export type JsonDiagnostic =
  | { ok: true; value: unknown }
  | { ok: false; code: 'json_empty' | 'json_html' | 'json_binary' | 'json_invalid'; line?: number; column?: number; snippet?: string; hint?: JsonHint }

const SNIPPET = 50

function positionFrom(message: string, raw: string): number | null {
  const m = /position (\d+)/.exec(message)
  if (m) return Math.min(Number(m[1]), raw.length)
  const lc = /line (\d+) column (\d+)/.exec(message)
  if (lc) {
    const lines = raw.split('\n')
    let pos = 0
    for (let i = 0; i < Number(lc[1]) - 1 && i < lines.length; i++) pos += lines[i].length + 1
    return Math.min(pos + Number(lc[2]) - 1, raw.length)
  }
  return null
}

/**
 * Position du premier caractère invalide (analyse descendante minimale). Les messages de `JSON.parse` ne donnent
 * pas toujours la position selon la version du moteur : on la retrouve nous-mêmes. `raw.length` = fin prématurée.
 */
export function findJsonErrorPosition(raw: string): number {
  let i = 0
  const n = raw.length
  const ws = () => { while (i < n && /\s/.test(raw[i])) i++ }
  const fail = (): never => { throw i }
  const literal = (word: string) => { if (raw.startsWith(word, i)) i += word.length; else fail() }
  const string = () => {
    i++ // "
    while (i < n) {
      const c = raw[i]
      if (c === '"') { i++; return }
      if (c === '\\') { i += 2; continue }
      if (c === '\n') fail()
      i++
    }
    fail()
  }
  const value = (): void => {
    ws()
    if (i >= n) fail()
    const c = raw[i]
    if (c === '{') {
      i++; ws()
      if (raw[i] === '}') { i++; return }
      for (;;) {
        ws(); if (raw[i] !== '"') fail()
        string(); ws(); if (raw[i] !== ':') fail()
        i++; value(); ws()
        if (raw[i] === ',') { i++; continue }
        if (raw[i] === '}') { i++; return }
        fail()
      }
    } else if (c === '[') {
      i++; ws()
      if (raw[i] === ']') { i++; return }
      for (;;) {
        value(); ws()
        if (raw[i] === ',') { i++; continue }
        if (raw[i] === ']') { i++; return }
        fail()
      }
    } else if (c === '"') string()
    else if (c === 't') literal('true')
    else if (c === 'f') literal('false')
    else if (c === 'n') literal('null')
    else if (/[-0-9]/.test(c)) { const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(raw.slice(i)); if (!m) fail(); i += m![0].length }
    else fail()
  }
  try { value(); ws(); return i < n ? i : n } catch (p) { return typeof p === 'number' ? p : n }
}

function lineColumn(raw: string, pos: number): { line: number; column: number } {
  const before = raw.slice(0, pos)
  const line = before.split('\n').length
  return { line, column: pos - (before.lastIndexOf('\n') + 1) + 1 }
}

function snippetAt(raw: string, pos: number): string {
  const from = Math.max(0, pos - 20)
  return raw.slice(from, from + SNIPPET).replace(/\s+/g, ' ').trim()
}

function hintFor(raw: string, pos: number, message: string): JsonHint | undefined {
  if (/end of JSON input|Unexpected end/i.test(message) || pos >= raw.trimEnd().length) return 'truncated'
  const before = raw.slice(0, pos).trimEnd()
  const current = raw[pos]
  if (before.endsWith(',') && (current === '}' || current === ']')) return 'trailing_comma'
  if (current === "'" || /'[^'"\n]*'\s*:/.test(raw.slice(Math.max(0, pos - 1), pos + 40))) return 'single_quotes'
  if (current === '/' && (raw[pos + 1] === '/' || raw[pos + 1] === '*')) return 'comments'
  return undefined
}

export function diagnoseJsonText(input: string): JsonDiagnostic {
  const raw = input.replace(/^﻿/, '')
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, code: 'json_empty' }
  if (/^<(!doctype|html|\?xml)/i.test(trimmed)) return { ok: false, code: 'json_html' }
  if (trimmed.startsWith('PK\u0003\u0004') || trimmed.startsWith('%PDF') || raw.slice(0, 200).includes('\u0000')) return { ok: false, code: 'json_binary' }
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch (e) {
    const message = e instanceof Error ? e.message : ''
    const pos = positionFrom(message, raw) ?? findJsonErrorPosition(raw)
    const { line, column } = lineColumn(raw, pos)
    const hint = hintFor(raw, pos, message)
    return { ok: false, code: 'json_invalid', line, column, snippet: snippetAt(raw, pos), ...(hint ? { hint } : {}) }
  }
}
