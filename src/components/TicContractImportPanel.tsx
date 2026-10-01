'use client'

// ─── Import guidé de contrats TIC (CSV / XLSX) ───────────────────────────────
// Aperçu ligne à ligne (prête / déjà importée / rejetée + raison, valeurs par défaut signalées), identité de tiers proposée :
// lien posé seulement sur demande explicite ET sur LEI identique. Une référence existante n'est jamais écrasée.

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { checkTabularUpload } from '@/lib/import-file-format'

type Line = { line: number; status: 'READY' | 'ALREADY_IMPORTED' | 'REJECTED'; reason?: string; warnings: string[]; reference: string; prestataire: string; tier?: { tierId: string; strength: 'STRONG' | 'WEAK' } }
type Counts = { ready: number; alreadyImported: number; rejected: number; certainLinks: number }
type Result = { sheet: string; lines: Line[]; counts: Counts; created?: number; linked?: number }

const TEMPLATE = '﻿Reference;Provider;LEI;Country;Service type;Criticality;Start date;End date;Function\nC-001;Acme Cloud SAS;549300ABCDEFGHIJ1234;FR;CLOUD;CRITIQUE;2024-01-15;2027-01-14;Paie\nC-002;Beta Support;;DE;SUPPORT;;;;\n'

function readBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then(b => new Uint8Array(b))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer)); reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}
async function toBase64(file: File): Promise<string> {
  const bytes = await readBytes(file)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

export default function TicContractImportPanel({ onImported }: { onImported: () => void }) {
  const { t } = useTranslation()
  const c = t.ticImport
  const errors = t.analyses.importMenu.importErrors as Record<string, { title: string; likelyCauses: string; solution: string } | undefined>
  const [file, setFile] = useState<{ name: string; data: string } | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [linkCertain, setLinkCertain] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ created: number; linked: number } | null>(null)

  const describeError = (code: string, headers?: string[]) => {
    if (code === 'tic_columns_missing') return c.columnsMissing.replace('{headers}', (headers ?? []).join(', '))
    const known = errors[code]
    return known ? `${known.title}. ${known.likelyCauses} ${known.solution}` : c.failed
  }
  async function post(payload: { filename: string; data: string; dryRun: boolean; linkCertain?: boolean }) {
    const res = await fetch('/api/reglementaire/registre-tic/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    return { ok: res.ok, body: await res.json().catch(() => ({})) }
  }
  async function onFile(selected: File | undefined) {
    if (!selected) return
    setError(null); setResult(null); setDone(null)
    const formatError = checkTabularUpload(selected.name, await readBytes(selected.slice(0, 16)))
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
      const { ok, body } = await post({ filename: file.name, data: file.data, dryRun: false, linkCertain })
      if (!ok) { setError(describeError(body.error, body.headers)); return }
      setDone({ created: body.created ?? 0, linked: body.linked ?? 0 }); setResult(body as Result); onImported()
    } catch { setError(c.failed) }
    finally { setBusy(false) }
  }
  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'contrats-tic-modele.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const statuses = c.statuses as Record<string, string>
  const reasons = c.reasons as Record<string, string>
  const warnings = c.warnings as Record<string, string>
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
      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100">{error}</p>}
      {done && <p role="status" className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-700 dark:bg-green-950/40 dark:text-green-100">✓ {c.created.replace('{n}', String(done.created)).replace('{l}', String(done.linked))}</p>}
      {result && (
        <>
          <p data-testid="counts" className="text-sm text-gray-700 dark:text-gray-200">
            {c.counts.ready.replace('{n}', String(result.counts.ready))} · {c.counts.already.replace('{n}', String(result.counts.alreadyImported))} · {c.counts.rejected.replace('{n}', String(result.counts.rejected))}
          </p>
          {done === null && result.counts.certainLinks > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
              <input type="checkbox" checked={linkCertain} onChange={e => setLinkCertain(e.target.checked)} />
              {c.linkCertain.replace('{n}', String(result.counts.certainLinks))}
            </label>
          )}
          <div className="max-h-96 overflow-auto rounded border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"><tr><th className="px-2 py-1">{c.colLine}</th><th className="px-2 py-1">{c.colContract}</th><th className="px-2 py-1">{c.colStatus}</th></tr></thead>
              <tbody>
                {result.lines.map(l => (
                  <tr key={l.line} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-1 text-gray-500">{l.line}</td>
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{l.reference || '—'} <span className="text-xs text-gray-500">{l.prestataire}</span></td>
                    <td className={`px-2 py-1 ${tone(l.status)}`}>
                      <span className="font-medium">{statuses[l.status]}</span>{l.reason && <span> — {reasons[l.reason] ?? l.reason}</span>}
                      {l.status === 'READY' && l.warnings.map(w => <span key={w} className="ml-2 text-xs text-amber-800 dark:text-amber-300">⚠ {warnings[w] ?? w}</span>)}
                      {l.status === 'READY' && l.tier && <span className="ml-2 text-xs text-gray-600 dark:text-gray-300">{l.tier.strength === 'STRONG' ? c.tierStrong : c.tierWeak}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {done === null && (
            <button type="button" className="btn-primary inline-flex items-center gap-2 disabled:opacity-50" disabled={busy || result.counts.ready === 0} aria-busy={busy} onClick={() => void submit()}>
              {busy ? c.importing : c.import.replace('{n}', String(result.counts.ready))}
            </button>
          )}
        </>
      )}
    </section>
  )
}
