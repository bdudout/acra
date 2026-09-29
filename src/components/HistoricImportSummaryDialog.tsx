'use client'

import { useEffect, useMemo, useState } from 'react'
import type { HistoricImportDecision, HistoricColumnMapping, HistoricFieldTransforms, HistoricSheetType } from '@/lib/historic-import'

type Mapping = { id: string; name: string }
type Selection = { mappings: Record<string, HistoricColumnMapping>; sheetTypes: Record<string, HistoricSheetType>; transforms: Record<string, HistoricFieldTransforms>; statusMappings: Record<string, Record<string, string>>; scoreMappings: Record<string, Record<string, Record<string, string>>>; organizationId?: string }
type ImportResult = { warnings?: string[]; ateliers?: Record<string, number>; imported: number; results: Array<{ nom?: string; created?: { risks?: number; vulnerabilities?: number; measures?: number; actions?: number } }>; decisions: HistoricImportDecision[] }

export type HistoricImportSummaryLabels = {
  title: string; explanation: string; imported: string; importedRows: string; omittedFields: string; rejectedRows: string
  created: { risks: string; vulnerabilities: string; measures: string; actions: string }
  sourceValue: string; expectedValue: string; emptyValue: string
  reasons: Record<string, string>
  ignoredTemplateRows?: string
  ateliers?: { title: string; counts: Record<string, string> }
  warnings?: { title: string; codes: Record<string, string> }
  close: string
  mapping: { title: string; explanation: string; newMapping: string; updateMapping: string; save: string; saved: string }
}

/** Bilan transactionnel de l'import Excel : il remplace l'assistant à la réussite. */
export default function HistoricImportSummaryDialog({ result, selection, labels, onClose }: { result: ImportResult; selection: Selection; labels: HistoricImportSummaryLabels; onClose: () => void }) {
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [mappingName, setMappingName] = useState('')
  const [saved, setSaved] = useState(false)
  const ready = result.decisions.filter(decision => decision.status === 'READY')
  const omitted = result.decisions.filter(decision => decision.status === 'FIELD_OMITTED')
  const rejected = result.decisions.filter(decision => decision.status === 'REJECTED')
  const ignored = result.decisions.filter(decision => decision.status === 'IGNORED')
  const created = useMemo(() => result.results.reduce((total, item) => ({ risks: total.risks + (item.created?.risks ?? 0), vulnerabilities: total.vulnerabilities + (item.created?.vulnerabilities ?? 0), measures: total.measures + (item.created?.measures ?? 0), actions: total.actions + (item.created?.actions ?? 0) }), { risks: 0, vulnerabilities: 0, measures: 0, actions: 0 }), [result.results])

  useEffect(() => {
    fetch(`/api/analysis-imports/mappings${selection.organizationId ? `?organizationId=${encodeURIComponent(selection.organizationId)}` : ''}`)
      .then(response => response.ok ? response.json() : { mappings: [] })
      .then(data => setMappings(data.mappings ?? []))
      .catch(() => {})
  }, [selection.organizationId])

  async function saveMapping() {
    if (!mappingName.trim()) return
    const response = await fetch('/api/analysis-imports/mappings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: mappingName.trim(), organizationId: selection.organizationId, mappings: selection.mappings, sheetTypes: selection.sheetTypes, transforms: selection.transforms, statusMappings: selection.statusMappings, scoreMappings: selection.scoreMappings }) })
    if (response.ok) setSaved(true)
  }
  function decisionLabel(decision: HistoricImportDecision) {
    return `${decision.sheetName} — ligne ${decision.row}`
  }

  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={labels.title}>
    <section className="card w-full max-w-3xl p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900">
      <h2 className="text-xl font-bold text-gray-900 dark:text-slate-50">{labels.title}</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{labels.explanation}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-950 dark:border-green-500/50 dark:bg-green-950/40 dark:text-green-50"><h3 className="font-semibold">{labels.imported}: {result.imported}</h3>{result.results.some(item => item.nom) && <ul className="mt-1 list-inside list-disc text-sm">{result.results.filter(item => item.nom).map((item, index) => <li key={`${item.nom}:${index}`}>{item.nom}</li>)}</ul>}<p className="mt-1 text-sm">{created.risks} {labels.created.risks} · {created.vulnerabilities} {labels.created.vulnerabilities} · {created.measures} {labels.created.measures} · {created.actions} {labels.created.actions}</p><p className="mt-1 text-xs">{ready.length} {labels.importedRows.toLowerCase()}</p></section>
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-400/60 dark:bg-amber-950/40 dark:text-amber-50"><h3 className="font-semibold">{labels.omittedFields}: {omitted.length}</h3><p className="mt-1 text-xs">{labels.rejectedRows}: {rejected.length}</p></section>
      </div>
      {result.ateliers && labels.ateliers && Object.keys(result.ateliers).length > 0 && <section className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-950 dark:border-green-500/50 dark:bg-green-950/40 dark:text-green-50" aria-label={labels.ateliers.title}>
        <h3 className="font-semibold">{labels.ateliers.title}</h3>
        <p className="mt-1">{Object.entries(result.ateliers).map(([key, n]) => `${n} ${labels.ateliers!.counts[key] ?? key}`).join(' · ')}</p>
      </section>}
      {ignored.length > 0 && labels.ignoredTemplateRows && <p role="note" className="mt-3 text-sm text-gray-600 dark:text-slate-300">{labels.ignoredTemplateRows.replace('{n}', String(ignored.length))}</p>}
      {result.warnings && result.warnings.length > 0 && labels.warnings && <section className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-400/60 dark:bg-amber-950/40 dark:text-amber-50" aria-label={labels.warnings.title}>
        <h3 className="font-semibold">{labels.warnings.title} ({result.warnings.length})</h3>
        <ul className="mt-1 list-inside list-disc space-y-0.5">{result.warnings.slice(0, 30).map((w, i) => { const [code, ...args] = w.split(':'); return <li key={i}>{(labels.warnings!.codes[code] ?? code).replace('{ref}', args.join(':')).replace('{a}', args[1] ?? '').replace('{b}', args[2] ?? '')}</li> })}</ul>
      </section>}
      {(omitted.length > 0 || rejected.length > 0) && <section className="mt-4 space-y-3" aria-label={labels.rejectedRows}>
        {rejected.length > 0 && <DecisionList decisions={rejected} title={labels.rejectedRows} labels={labels} decisionLabel={decisionLabel} tone="red" />}
        {omitted.length > 0 && <DecisionList decisions={omitted} title={labels.omittedFields} labels={labels} decisionLabel={decisionLabel} tone="amber" />}
      </section>}
      <section className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-950 dark:border-blue-400/50 dark:bg-slate-800 dark:text-slate-50"><h3 className="font-semibold">{labels.mapping.title}</h3><p className="mt-1 text-sm">{labels.mapping.explanation}</p><div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-xs font-medium">{labels.mapping.updateMapping}<select className="input mt-1 block text-sm" value={mappingName} onChange={event => { setMappingName(event.target.value); setSaved(false) }}><option value="">{labels.mapping.newMapping}</option>{mappings.map(mapping => <option key={mapping.id} value={mapping.name}>{mapping.name}</option>)}</select></label><label className="text-xs font-medium">{labels.mapping.newMapping}<input aria-label={labels.mapping.newMapping} className="input mt-1 block text-sm" value={mappingName} onChange={event => { setMappingName(event.target.value); setSaved(false) }} /></label><button type="button" className="btn-secondary text-sm" disabled={!mappingName.trim()} onClick={saveMapping}>{labels.mapping.save}</button></div>{saved && <p className="mt-2 text-sm font-medium">{labels.mapping.saved}</p>}</section>
      <div className="mt-5 flex justify-end border-t border-gray-200 pt-4 dark:border-slate-700"><button type="button" className="btn-primary" onClick={onClose}>{labels.close}</button></div>
    </section>
  </div>
}

function DecisionList({ decisions, title, labels, decisionLabel, tone }: { decisions: HistoricImportDecision[]; title: string; labels: HistoricImportSummaryLabels; decisionLabel: (decision: HistoricImportDecision) => string; tone: 'red' | 'amber' }) {
  const classes = tone === 'red' ? 'border-red-200 bg-red-50 text-red-950 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-50' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/60 dark:bg-amber-950/40 dark:text-amber-50'
  return <div className={`rounded-lg border p-3 ${classes}`}><h3 className="font-semibold">{title}</h3><ul className="mt-2 space-y-2 text-sm">{decisions.map((decision, index) => <li key={`${decision.sheetName}:${decision.row}:${decision.field}:${index}`}><p className="font-medium">{decisionLabel(decision)}{decision.field ? ` — ${decision.field}` : ''}</p><p className="text-xs">{labels.sourceValue}: {decision.sourceColumn ?? decision.field ?? '—'} = <code className="rounded bg-white/70 px-1 py-0.5 text-current dark:bg-slate-950/60">{decision.sourceValue?.trim() || labels.emptyValue}</code>{decision.expectedValue && <> · {labels.expectedValue}: {decision.expectedValue}</>}</p>{decision.reason && <p className="text-xs">{labels.reasons[decision.reason]}</p>}</li>)}</ul></div>
}
