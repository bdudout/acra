'use client'

// ─── Import guidé de processus (CSV / XLSX) ──────────────────────────────────
// Aperçu ligne à ligne (prête / déjà importée / doublon possible / rejetée + raison), lignes valides conservées, doublons
// possibles à confirmer un par un, bouton verrouillé pendant l'import. Rien n'est jamais fusionné.

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { checkTabularUpload } from '@/lib/import-file-format'
import { readBytes, toBase64 } from '@/lib/fichier-base64'

type Line = { line: number; status: 'READY' | 'ALREADY_IMPORTED' | 'POSSIBLE_DUPLICATE' | 'REJECTED'; reason?: string; nom: string; ref?: string; parentLine?: number; duplicateOfId?: string; duplicateOfLine?: number }
type Counts = { ready: number; alreadyImported: number; possibleDuplicate: number; rejected: number }
type Result = { sheet: string; lines: Line[]; counts: Counts; created?: number }

const TEMPLATE = '﻿Ref;Parent;Name;Description;Owner\nP1;;Gérer les achats;Consultation, commande et suivi des fournisseurs;\nP1.1;P1;Passer les commandes;;\nP2;;Gérer les ressources humaines;;\n'

export default function ProcessusImportPanel({ onImported }: { onImported: () => void }) {
  const { t } = useTranslation()
  const c = t.processusImport
  const errors = t.analyses.importMenu.importErrors as Record<string, { title: string; likelyCauses: string; solution: string } | undefined>
  const [file, setFile] = useState<{ name: string; data: string } | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [anyway, setAnyway] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)

  const describeError = (code: string, headers?: string[]) => {
    if (code === 'name_column_missing') return c.nameColumnMissing.replace('{headers}', (headers ?? []).join(', '))
    if (code === 'concurrent_import') return c.concurrent
    const known = errors[code]
    return known ? `${known.title}. ${known.likelyCauses} ${known.solution}` : c.failed
  }

  async function post(payload: { filename: string; data: string; dryRun: boolean; createAnyway?: number[] }) {
    const res = await fetch('/api/processus/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const body = await res.json().catch(() => ({}))
    return { ok: res.ok, body }
  }

  async function onFile(selected: File | undefined) {
    if (!selected) return
    setError(null); setResult(null); setDone(null); setAnyway([])
    const head = await readBytes(selected.slice(0, 16))
    const formatError = checkTabularUpload(selected.name, head)
    if (formatError) { setError(describeError(formatError)); return }
    setBusy(true)
    try {
      const data = await toBase64(selected)
      setFile({ name: selected.name, data })
      const { ok, body } = await post({ filename: selected.name, data, dryRun: true })
      if (!ok) { setError(describeError(body.error, body.headers)); return }
      setResult(body as Result)
    } catch { setError(c.failed) }
    finally { setBusy(false) }
  }

  async function submit() {
    if (!file || !result) return
    setBusy(true); setError(null)
    try {
      const { ok, body } = await post({ filename: file.name, data: file.data, dryRun: false, createAnyway: anyway })
      if (!ok) { setError(describeError(body.error, body.headers)); return }
      setDone(body.created ?? 0); setResult(body as Result); setAnyway([]); onImported()
    } catch { setError(c.failed) }
    finally { setBusy(false) }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'processus-modele.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const statuses = c.statuses as Record<string, string>
  const reasons = c.reasons as Record<string, string>
  const toImport = result ? result.counts.ready + anyway.length : 0
  const tone = (s: Line['status']) => s === 'READY' ? 'text-green-800 dark:text-green-300' : s === 'REJECTED' ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'

  return (
    <section className="card mb-5 space-y-3 p-4" aria-label={c.title}>
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">{c.title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{c.hint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-700 dark:text-gray-200">{c.file}
          <input type="file" accept=".csv,.xlsx" aria-label={c.file} className="mt-1 block text-sm" disabled={busy} onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        <button type="button" className="btn-secondary text-sm" onClick={downloadTemplate}>{c.template}</button>
      </div>
      {error && <p role="alert" className="rounded-sm border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100">{error}</p>}
      {done !== null && <p role="status" className="rounded-sm border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-700 dark:bg-green-950/40 dark:text-green-100">✓ {c.created.replace('{n}', String(done))}</p>}
      {result && (
        <>
          <p data-testid="counts" className="text-sm text-gray-700 dark:text-gray-200">
            {c.counts.ready.replace('{n}', String(result.counts.ready))} · {c.counts.already.replace('{n}', String(result.counts.alreadyImported))} · {c.counts.duplicate.replace('{n}', String(result.counts.possibleDuplicate))} · {c.counts.rejected.replace('{n}', String(result.counts.rejected))}
          </p>
          <div className="max-h-96 overflow-auto rounded-sm border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"><tr><th className="px-2 py-1">{c.colLine}</th><th className="px-2 py-1">{c.colName}</th><th className="px-2 py-1">{c.colStatus}</th></tr></thead>
              <tbody>
                {result.lines.map(l => (
                  <tr key={l.line} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-1 text-gray-500">{l.line}</td>
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{l.nom || '—'}{l.ref && <span className="ml-2 text-xs text-gray-500">{l.ref}</span>}</td>
                    <td className={`px-2 py-1 ${tone(l.status)}`}>
                      <span className="font-medium">{statuses[l.status]}</span>{l.reason && <span> — {reasons[l.reason] ?? l.reason}</span>}
                      {l.status === 'POSSIBLE_DUPLICATE' && done === null && (
                        <label className="ml-3 inline-flex items-center gap-1 text-xs text-gray-800 dark:text-gray-100">
                          <input type="checkbox" checked={anyway.includes(l.line)} onChange={() => setAnyway(list => list.includes(l.line) ? list.filter(x => x !== l.line) : [...list, l.line])} aria-label={`${c.createAnyway} — ${l.nom}`} />
                          {c.createAnyway}
                        </label>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {done === null && (
            <button type="button" className="btn-primary inline-flex items-center gap-2 disabled:opacity-50" disabled={busy || toImport === 0} aria-busy={busy} onClick={() => void submit()}>
              {busy && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>}
              {busy ? c.importing : c.import.replace('{n}', String(toImport))}
            </button>
          )}
        </>
      )}
    </section>
  )
}
