'use client'

import { useEffect, useMemo, useState } from 'react'
import type { HistoricColumnMapping, HistoricSheetType } from '@/lib/historic-import'

export type HistoricPreviewSheet = {
  name: string
  columns: string[]
  rows: number
  detection: { type: HistoricSheetType }
  mapping: HistoricColumnMapping
  missing: string[]
}

export type HistoricImportPreviewLabels = {
  title: string
  confirm: string
  cancel: string
  missing: string
  noSheets: string
  rows: string
  fieldLabels: Record<string, string>
  mappingName: string
  saveMapping: string
  loadMapping: string
}

const mappingFields: Partial<Record<HistoricSheetType, string[]>> = {
  ANALYSES: ['title', 'description'],
  RISKS: ['analysisExternalId', 'externalId', 'title', 'description', 'gravity', 'likelihood', 'strategy'],
  VULNERABILITIES: ['riskExternalId', 'title', 'description'],
  MEASURES: ['externalId', 'riskExternalId', 'title', 'description', 'status', 'responsible', 'dueDate'],
  ACTIONS: ['externalId', 'riskExternalId', 'title', 'description', 'responsible', 'dueDate'],
  RISK_ACTION_LINKS: ['riskExternalId', 'actionExternalId'],
}

export default function HistoricImportPreview({ sheets, labels, onCancel, onConfirm }: {
  sheets: HistoricPreviewSheet[]
  labels: HistoricImportPreviewLabels
  onCancel: () => void
  onConfirm: (mappings: Record<string, HistoricColumnMapping>) => void
}) {
  const usable = sheets.filter(sheet => sheet.detection.type !== 'UNKNOWN' && sheet.rows > 0)
  const [mappings, setMappings] = useState<Record<string, HistoricColumnMapping>>(() => Object.fromEntries(usable.map(sheet => [sheet.name, sheet.mapping])))
  const [mappingName, setMappingName] = useState('')
  const [savedMappings, setSavedMappings] = useState<Array<{ id: string; name: string; mappings: Record<string, HistoricColumnMapping> }>>([])
  useEffect(() => { fetch('/api/analysis-imports/mappings').then(response => response.ok ? response.json() : { mappings: [] }).then(data => setSavedMappings(data.mappings ?? [])).catch(() => {}) }, [])
  const invalid = useMemo(() => usable.some(sheet => (mappingFields[sheet.detection.type] ?? []).filter(field =>
    (field === 'title' || sheet.detection.type === 'RISK_ACTION_LINKS' || (sheet.detection.type === 'VULNERABILITIES' && field === 'riskExternalId')) && !mappings[sheet.name]?.[field]?.trim(),
  ).length > 0), [mappings, usable])

  return (
    <section className="card mt-4 p-4" aria-label={labels.title}>
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-semibold text-gray-900">{labels.title}</h2><p className="text-sm text-gray-500">{usable.reduce((sum, s) => sum + s.rows, 0)} {labels.rows}</p></div>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-900">{labels.cancel}</button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-gray-700">{labels.loadMapping}<select className="input mt-1 block text-sm" value="" onChange={event => { const selected = savedMappings.find(item => item.id === event.target.value); if (selected) setMappings(selected.mappings) }}><option value="">—</option>{savedMappings.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs font-medium text-gray-700">{labels.mappingName}<input className="input mt-1 block text-sm" value={mappingName} onChange={event => setMappingName(event.target.value)} /></label>
        <button type="button" className="btn-secondary text-sm" disabled={!mappingName.trim()} onClick={async () => { const response = await fetch('/api/analysis-imports/mappings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: mappingName, mappings }) }); if (response.ok) { const data = await response.json(); setSavedMappings(previous => [...previous.filter(item => item.id !== data.mapping.id && item.name !== data.mapping.name), data.mapping]); setMappingName('') } }}>{labels.saveMapping}</button>
      </div>
      {usable.length === 0 ? <p className="mt-3 text-sm text-amber-700">{labels.noSheets}</p> : <div className="mt-4 space-y-4">
        {usable.map(sheet => {
          const fields = mappingFields[sheet.detection.type] ?? []
          return <div key={sheet.name} className="rounded-lg border border-gray-200 p-3">
            <p className="font-medium text-sm text-gray-800">{sheet.name} <span className="font-normal text-gray-500">· {sheet.rows} {labels.rows} · {sheet.detection.type}</span></p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {fields.map(field => {
                const required = field === 'title' || sheet.detection.type === 'RISK_ACTION_LINKS' || (sheet.detection.type === 'VULNERABILITIES' && field === 'riskExternalId')
                const value = mappings[sheet.name]?.[field] ?? ''
                return <label key={field} className="text-xs font-medium text-gray-700">
                  {sheet.name} — {labels.fieldLabels[field] ?? field}{required ? ` (${labels.missing})` : ''}
                  <select aria-label={`${sheet.name} — ${labels.fieldLabels[field] ?? field}`} value={value} onChange={event => setMappings(prev => ({ ...prev, [sheet.name]: { ...prev[sheet.name], [field]: event.target.value || undefined } }))} className="input mt-1 w-full text-sm">
                    <option value="">—</option>{sheet.columns.map(column => <option key={column} value={column}>{column}</option>)}
                  </select>
                </label>
              })}
            </div>
          </div>
        })}
      </div>}
      <div className="mt-4 flex justify-end"><button type="button" className="btn-primary" disabled={usable.length === 0 || invalid} onClick={() => onConfirm(mappings)}>{labels.confirm}</button></div>
    </section>
  )
}
