'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ATELIER_ROLE_FIELDS, suggestAtelierMapping } from '@/lib/import-ateliers-build'
import { isAtelierRole } from '@/lib/historic-import'
import { suggestPrefixAlias, suggestValueMap } from '@/lib/import-transforms'
import { BUILTIN_PROFILES, rankProfiles, profileToSelection, type ImportProfile } from '@/lib/import-profile'
import { getHistoricColumnCompatibility, HISTORIC_MULTI_COLUMN_SEPARATOR, splitHistoricMappedColumns, suggestScoreMapping, validateHistoricColumnProfile, validateHistoricImportSelection, type HistoricColumnMapping, type HistoricImportDecision, type HistoricColumnProfile, type HistoricFieldTransforms, type HistoricSheetType, type HistoricValueTransform } from '@/lib/historic-import'

export type HistoricPreviewSheet = {
  name: string
  columns: string[]
  profiles?: Record<string, HistoricColumnProfile>
  rows: number
  detection: { type: HistoricSheetType }
  mapping: HistoricColumnMapping
  missing: string[]
  /** Formules sans valeur enregistrée / en erreur (classeur jamais recalculé, #REF!…). */
  warnings?: { formulasWithoutValue?: { count: number; samples: string[] }; formulaErrors?: { count: number; samples: string[] } }
}
export type HistoricRequiredValueGap = { sheetName: string; row: number; field: string; sourceColumn?: string; sourceValue?: string; expectedValue?: string }
export type HistoricImportOrganizationOption = { id: string; nom: string }

export type HistoricImportPreviewLabels = {
  title: string
  confirm: string
  cancel: string
  missing: string
  noSheets: string
  rows: string
  mappingName: string
  saveMapping: string
  loadMapping: string
  sheetRole: string
  ignoreSheet: string
  summaryTitle: string
  importableSheets: string
  ignoredSheets: string
  mappingHelpTitle: string
  mappingHelp: string
  targetOrganization?: string
  aliasPrefix?: string
  valueMap?: { title: string; hint: string; other: string; category: Record<string, string>; type: Record<string, string> }
  profile?: { recognized: string; apply: string; applied?: string; builtin: string; partial: string }
  /** « Mapping « {name} » chargé : {n} feuille(s) configurée(s). » */
  mappingLoaded?: string
  importing?: string
  warnings?: { noValue: string; errors: string }
  fieldLabels: Record<string, string>
  sheetTypes: Partial<Record<Exclude<HistoricSheetType, 'UNKNOWN'>, string>>
  validation?: { acraField: string; sourceColumn: string; expected: string; examples: string; compatible: string; review: string; invalidValues: string; externalReference: string }
  listTransform?: { label: string; none: string; lines: string; semicolon: string; pipe: string; carryForward?: string }
  completion?: { title: string; explanation: string; skip: string; complete: string; value: string; sourceValue: string; expectedValue: string; emptyValue: string; skipSummary: string; completeSummary: string; groupSummary?: string; skipAll?: string; perRow?: string; importableTitle?: string; importableReady?: string; importableToDecide?: string; importableTemplate?: string }
}

const mappingFields: Partial<Record<HistoricSheetType, string[]>> = {
  ...ATELIER_ROLE_FIELDS,
  ANALYSES: ['externalId', 'title', 'description'],
  RISKS: ['analysisExternalId', 'externalId', 'title', 'description', 'gravity', 'likelihood', 'strategy', 'embeddedVulnerabilities', 'embeddedActions'],
  VULNERABILITIES: ['riskExternalId', 'title', 'description'],
  MEASURES: ['externalId', 'riskExternalId', 'title', 'description', 'status', 'responsible', 'dueDate'],
  ACTIONS: ['externalId', 'riskExternalId', 'title', 'description', 'responsible', 'dueDate'],
  RISK_ACTION_LINKS: ['riskExternalId', 'actionExternalId'],
}

/** Au-delà de ce nombre de lignes à décider dans une même feuille, elles sont regroupées et repliées (action globale). */
const INCOMPLETE_GROUP_THRESHOLD = 5

export default function HistoricImportPreview({ sheets, labels, requiredValueGaps = [], reviewDecisions, importing = false, organizationOptions, defaultOrganizationId, onCancel, onConfirm }: {
  sheets: HistoricPreviewSheet[]
  labels: HistoricImportPreviewLabels
  requiredValueGaps?: HistoricRequiredValueGap[]
  /** Décisions de l'aperçu à blanc (prêtes / ignorées / à décider) : alimentent « Ce qui sera importé ». */
  reviewDecisions?: HistoricImportDecision[]
  organizationOptions?: HistoricImportOrganizationOption[]
  defaultOrganizationId?: string
  onCancel: () => void
  /** Import en cours (aperçu à blanc ou écriture) : bouton verrouillé avec indicateur. */
  importing?: boolean
  onConfirm: (selection: { mappings: Record<string, HistoricColumnMapping>; sheetTypes: Record<string, HistoricSheetType>; transforms: Record<string, HistoricFieldTransforms>; statusMappings: Record<string, Record<string, string>>; scoreMappings: Record<string, Record<string, Record<string, string>>>; rowOverrides: Record<string, Record<string, Record<string, string>>>; refAliases?: Record<string, Record<string, string>>; valueMaps?: Record<string, Record<string, Record<string, string>>>; organizationId?: string }) => void | Promise<void>
}) {
  const visibleSheets = sheets.filter(sheet => sheet.rows > 0)
  const validationLabels = labels.validation ?? { acraField: 'ACRA field', sourceColumn: 'Excel column', expected: 'Expected type', examples: 'Examples', compatible: 'Compatible', review: 'Review', invalidValues: 'invalid values', externalReference: 'Matching identifier' }
  const [mappings, setMappings] = useState<Record<string, HistoricColumnMapping>>(() => Object.fromEntries(visibleSheets.map(sheet => [sheet.name, sheet.mapping])))
  const [sheetTypes, setSheetTypes] = useState<Record<string, HistoricSheetType>>(() => Object.fromEntries(visibleSheets.map(sheet => [sheet.name, sheet.detection.type])))
  const [statusMappings, setStatusMappings] = useState<Record<string, Record<string, string>>>({})
  const [scoreMappings, setScoreMappings] = useState<Record<string, Record<string, Record<string, string>>>>({})
  const [transforms, setTransforms] = useState<Record<string, HistoricFieldTransforms>>({})
  // Retour visible et annoncé (lecteur d'écran) après « Appliquer ce profil » / chargement d'un mapping : sans lui, un classeur déjà bien détecté ne montre aucun changement.
  // Verrou synchrone contre le double clic : posé au clic, levé quand la promesse du parent se termine.
  const submitting = useRef(false)
  const [submitted, setSubmitted] = useState(false)
  const busy = importing || submitted
  const [feedback, setFeedback] = useState<string | null>(null)
  const [rowActions, setRowActions] = useState<Record<string, 'SKIP' | 'COMPLETE'>>({})
  const [valueMaps, setValueMaps] = useState<Record<string, Record<string, Record<string, string>>>>({})
  const [refAliases, setRefAliases] = useState<Record<string, Record<string, string>>>({})
  const [rowOverrides, setRowOverrides] = useState<Record<string, Record<string, Record<string, string>>>>({})
  const [loadedOrganizations, setLoadedOrganizations] = useState<HistoricImportOrganizationOption[]>([])
  const [targetOrganizationId, setTargetOrganizationId] = useState(defaultOrganizationId ?? '')
  const [savedMappings, setSavedMappings] = useState<Array<{ id: string; name: string; refAliases?: Record<string, Record<string, string>>; mappings: Record<string, HistoricColumnMapping>; sheetTypes?: Record<string, HistoricSheetType>; transforms?: Record<string, HistoricFieldTransforms>; statusMappings?: Record<string, Record<string, string>>; scoreMappings?: Record<string, Record<string, Record<string, string>>> }>>([])
  useEffect(() => { if (!organizationOptions) fetch('/api/org/active').then(response => response.ok ? response.json() : null).then(data => { if (data) { setLoadedOrganizations(data.options ?? []); setTargetOrganizationId(current => current || data.activeOrgId || '') } }).catch(() => {}) }, [organizationOptions])
  const availableOrganizations = organizationOptions ?? loadedOrganizations
  // Reconnaissance d'un profil (livré ou enregistré par l'organisation) sur les feuilles du fichier (lot I4).
  const recognized = useMemo(() => {
    const asProfiles: ImportProfile[] = savedMappings.map(item => ({
      version: 1, id: item.id, name: item.name,
      sheets: Object.keys(item.mappings).map(sheetName => ({ match: { name: sheetName }, role: item.sheetTypes?.[sheetName] ?? 'UNKNOWN', fields: item.mappings[sheetName] })),
      statusMappings: item.statusMappings ?? {}, scoreMappings: item.scoreMappings ?? {},
    }))
    return rankProfiles([...BUILTIN_PROFILES, ...asProfiles], sheets.map(sheet => ({ name: sheet.name, columns: sheet.columns })))[0]
  }, [savedMappings, sheets])
  function applyProfile() {
    if (!recognized) return
    const selection = profileToSelection(recognized.profile, sheets.map(sheet => ({ name: sheet.name, columns: sheet.columns })))
    setMappings(previous => ({ ...previous, ...selection.mappings }))
    setSheetTypes(previous => ({ ...previous, ...selection.sheetTypes }))
    setStatusMappings(previous => ({ ...previous, ...selection.statusMappings }))
    setScoreMappings(previous => ({ ...previous, ...selection.scoreMappings }))
    const configured = Object.values(selection.sheetTypes).filter(type => type !== 'UNKNOWN').length
    setFeedback((labels.profile?.applied ?? '{name} : {n}').replace('{name}', recognized.profile.name).replace('{n}', String(configured)))
  }
  useEffect(() => { fetch(`/api/analysis-imports/mappings${targetOrganizationId ? `?organizationId=${encodeURIComponent(targetOrganizationId)}` : ''}`).then(response => response.ok ? response.json() : { mappings: [] }).then(data => setSavedMappings(data.mappings ?? [])).catch(() => {}) }, [targetOrganizationId])
  // Cotations en clair (« Critique », « Vraisemblable ») : niveaux PROPOSÉS, visibles et modifiables, seulement si toute l'échelle est reconnue.
  useEffect(() => {
    setScoreMappings(previous => {
      let next = previous
      for (const sheet of visibleSheets) for (const field of ['gravity', 'likelihood'] as const) {
        const column = splitHistoricMappedColumns(mappings[sheet.name]?.[field])[0]
        if (!column || previous[sheet.name]?.[field]) continue
        const suggestion = suggestScoreMapping(field, sheet.profiles?.[column]?.values ?? [])
        if (suggestion) next = { ...next, [sheet.name]: { ...(next[sheet.name] ?? {}), [field]: suggestion } }
      }
      return next
    })
  }, [mappings, visibleSheets])
  const selectedSheets = visibleSheets.filter(sheet => sheetTypes[sheet.name] !== 'UNKNOWN')
  // Préfixe des références de risques cité par une mesure ≠ préfixe des risques (R_ / RI_) : alias PROPOSÉ, jamais appliqué sans validation.
  const prefixHints = useMemo(() => {
    const riskIds = visibleSheets.filter(sheet => sheetTypes[sheet.name] === 'RISKS').flatMap(sheet => { const col = splitHistoricMappedColumns(mappings[sheet.name]?.externalId)[0]; return col ? sheet.profiles?.[col]?.values ?? [] : [] })
    if (riskIds.length === 0) return {} as Record<string, { from: string; to: string }[]>
    return Object.fromEntries(visibleSheets.filter(sheet => sheetTypes[sheet.name] === 'MEASURES' || sheetTypes[sheet.name] === 'ACTIONS').flatMap(sheet => {
      const col = splitHistoricMappedColumns(mappings[sheet.name]?.riskExternalId)[0]
      const hints = col ? suggestPrefixAlias(sheet.profiles?.[col]?.values ?? [], riskIds) : []
      return hints.length ? [[sheet.name, hints]] : []
    }))
  }, [mappings, sheetTypes, visibleSheets])
  const ignoredSheets = visibleSheets.filter(sheet => sheetTypes[sheet.name] === 'UNKNOWN')
  const blockers = useMemo(() => {
    const selection = selectedSheets.map(sheet => ({ name: sheet.name, type: sheetTypes[sheet.name], mapping: mappings[sheet.name] ?? {}, profiles: sheet.profiles, statusMapping: statusMappings[sheet.name] }))
    // Les défauts de format sont signalés sur chaque champ et traités ligne par
    // ligne par l'import partiel. Seuls les prérequis structurels doivent donc
    // empêcher l'utilisateur de lancer l'import du sous-ensemble sain.
    return validateHistoricImportSelection(selection)
  }, [mappings, selectedSheets, sheetTypes, statusMappings])
  const invalid = blockers.length > 0
  const incompleteRows = requiredValueGaps.reduce<Record<string, HistoricRequiredValueGap[]>>((result, gap) => {
    const key = `${gap.sheetName}:${gap.row}`
    ;(result[key] ??= []).push(gap)
    return result
  }, {})
  const incompleteRowEntries = Object.entries(incompleteRows)
  const completedRows = incompleteRowEntries.filter(([key]) => rowActions[key] === 'COMPLETE')
  const skippedRows = incompleteRowEntries.filter(([key]) => rowActions[key] !== 'COMPLETE')
  const completionIncomplete = completedRows.some(([, gaps]) => gaps.some(gap => !rowOverrides[gap.sheetName]?.[String(gap.row)]?.[gap.field]?.trim()))
  const completion = labels.completion
  const incompleteBySheet = incompleteRowEntries.reduce<Record<string, [string, HistoricRequiredValueGap[]][]>>((groups, entry) => { (groups[entry[1][0].sheetName] ??= []).push(entry); return groups }, {})
  // « Ce qui sera importé » par objet (rôle de feuille) : lignes prêtes, à décider, modèles vides ignorés.
  const importableByObject = (() => {
    const byRole = new Map<string, { role: string; ready: number; toDecide: number; template: number }>()
    const entry = (sheetName: string) => { const role = sheetTypes[sheetName]; if (!role || role === 'UNKNOWN') return null; if (!byRole.has(role)) byRole.set(role, { role, ready: 0, toDecide: 0, template: 0 }); return byRole.get(role)! }
    for (const decision of reviewDecisions ?? []) { const e = entry(decision.sheetName); if (!e) continue; if (decision.status === 'READY') e.ready += 1; else if (decision.status === 'IGNORED') e.template += 1 }
    for (const [sheetName, entries] of Object.entries(incompleteBySheet)) { const e = entry(sheetName); if (e) e.toDecide += entries.length }
    return [...byRole.values()].filter(item => item.ready + item.toDecide + item.template > 0)
  })()
  const renderIncompleteRow = ([key, gaps]: [string, HistoricRequiredValueGap[]]) => {
            if (!completion) return null
            const first = gaps[0]
            const action = rowActions[key] ?? 'SKIP'
            const lineLabel = `${first.sheetName} — ligne ${first.row}`
            return <fieldset key={key} className="rounded-sm border border-amber-200 bg-white p-3 text-gray-900 dark:border-amber-300/40 dark:bg-slate-900 dark:text-slate-100"><legend className="px-1 font-medium">{lineLabel} — {gaps.map(gap => labels.fieldLabels[gap.field] ?? gap.field).join(', ')}</legend>
              <div className="mb-3 space-y-1 text-xs text-gray-700 dark:text-slate-300">{gaps.map(gap => <p key={gap.field}><span className="font-semibold">{completion.sourceValue} :</span> {gap.sourceColumn ?? labels.fieldLabels[gap.field] ?? gap.field} = <code className="rounded-sm bg-amber-100 px-1 py-0.5 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">{gap.sourceValue?.trim() || completion.emptyValue}</code>{gap.expectedValue && <><span className="mx-1">·</span><span className="font-semibold">{completion.expectedValue} :</span> {gap.expectedValue}</>}</p>)}</div>
              <label className="mr-4 inline-flex items-center gap-2"><input type="radio" name={`row-action-${key}`} checked={action === 'SKIP'} onChange={() => setRowActions(previous => ({ ...previous, [key]: 'SKIP' }))} aria-label={`${lineLabel} — ${labels.fieldLabels[first.field] ?? first.field} — ${completion.skip}`} />{completion.skip}</label>
              <label className="inline-flex items-center gap-2"><input type="radio" name={`row-action-${key}`} checked={action === 'COMPLETE'} onChange={() => setRowActions(previous => ({ ...previous, [key]: 'COMPLETE' }))} aria-label={`${lineLabel} — ${labels.fieldLabels[first.field] ?? first.field} — ${completion.complete}`} />{completion.complete}</label>
              {action === 'COMPLETE' && <div className="mt-3 grid gap-2 sm:grid-cols-2">{gaps.map(gap => <label key={gap.field} className="text-xs font-medium">{labels.fieldLabels[gap.field] ?? gap.field}<input aria-label={`${lineLabel} — ${labels.fieldLabels[gap.field] ?? gap.field} — ${completion.value}`} className="input mt-1 block w-full text-sm" value={rowOverrides[gap.sheetName]?.[String(gap.row)]?.[gap.field] ?? ''} onChange={event => setRowOverrides(previous => ({ ...previous, [gap.sheetName]: { ...previous[gap.sheetName], [String(gap.row)]: { ...previous[gap.sheetName]?.[String(gap.row)], [gap.field]: event.target.value } } }))} /></label>)}</div>}
            </fieldset>
          }

  return (
    <section className="card mt-4 mb-10 p-4" aria-label={labels.title}>
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-semibold text-gray-900">{labels.title}</h2><p className="text-sm text-gray-500">{selectedSheets.reduce((sum, s) => sum + s.rows, 0)} {labels.rows}</p></div>
        <button type="button" onClick={onCancel} disabled={busy} className="text-sm text-gray-500 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50">{labels.cancel}</button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {availableOrganizations.length > 1 && labels.targetOrganization && <label className="text-xs font-medium text-gray-700">{labels.targetOrganization}<select aria-label={labels.targetOrganization} className="input mt-1 block text-sm" value={targetOrganizationId} onChange={event => setTargetOrganizationId(event.target.value)}>{availableOrganizations.map(organization => <option key={organization.id} value={organization.id}>{organization.nom}</option>)}</select></label>}
        <label className="text-xs font-medium text-gray-700">{labels.loadMapping}<select className="input mt-1 block text-sm" value="" onChange={event => { const selected = savedMappings.find(item => item.id === event.target.value); if (selected) { if (selected.refAliases) setRefAliases(selected.refAliases); setFeedback((labels.mappingLoaded ?? '{name} : {n}').replace('{name}', selected.name).replace('{n}', String(Object.values(selected.sheetTypes ?? {}).filter(type => type !== 'UNKNOWN').length || Object.keys(selected.mappings).length))); setMappings(selected.mappings); if (selected.sheetTypes) setSheetTypes(previous => ({ ...previous, ...selected.sheetTypes })); if (selected.transforms) setTransforms(selected.transforms); if (selected.statusMappings) setStatusMappings(selected.statusMappings); if (selected.scoreMappings) setScoreMappings(selected.scoreMappings) } }}><option value="">—</option>{savedMappings.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      {recognized && labels.profile && <div role="status" className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-950 dark:border-green-700 dark:bg-green-950/40 dark:text-green-100">
        <span>{labels.profile.recognized.replace('{name}', recognized.profile.name).replace('{pct}', String(Math.round(recognized.score * 100)))}{recognized.profile.builtin ? ` — ${labels.profile.builtin}` : ''}{recognized.profile.partial ? ` — ${labels.profile.partial}` : ''}</span>
        <button type="button" onClick={applyProfile} className="btn-secondary text-xs">{labels.profile.apply}</button>
      </div>}
      {feedback && <p role="status" aria-live="polite" className="mt-3 rounded-lg border border-green-300 bg-green-50 p-3 text-sm font-medium text-green-950 dark:border-green-700 dark:bg-green-950/40 dark:text-green-100">✓ {feedback}</p>}
      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
        <p className="font-semibold">{labels.mappingHelpTitle}</p><p className="mt-1">{labels.mappingHelp}</p>
        <p className="mt-2"><span className="font-medium">{labels.summaryTitle} :</span> {selectedSheets.length} {labels.importableSheets.toLowerCase()} · {ignoredSheets.length} {labels.ignoredSheets.toLowerCase()}</p>
        {selectedSheets.length > 0 && <p className="mt-1 text-xs"><span className="font-medium">{labels.importableSheets} :</span> {selectedSheets.map(sheet => `${sheet.name} (${labels.sheetTypes[sheetTypes[sheet.name] as Exclude<HistoricSheetType, 'UNKNOWN'>]})`).join(', ')}</p>}
        {ignoredSheets.length > 0 && <p className="mt-1 text-xs"><span className="font-medium">{labels.ignoredSheets} :</span> {ignoredSheets.map(sheet => sheet.name).join(', ')}</p>}
        <p className="mt-2 text-xs">✓ compatible · ⚠ à vérifier manuellement · ✕ bloquant avant import</p>
      </div>
      {visibleSheets.length === 0 ? <p className="mt-3 text-sm text-amber-700">{labels.noSheets}</p> : <div className="mt-4 space-y-4">
        {visibleSheets.map(sheet => {
          const type = sheetTypes[sheet.name]
          const fields = mappingFields[type] ?? []
          return <div key={sheet.name} className="rounded-lg border border-gray-200 p-3">
            <p className="font-medium text-sm text-gray-800">{sheet.name} <span className="font-normal text-gray-500">· {sheet.rows} {labels.rows} · {type === 'UNKNOWN' ? labels.ignoreSheet : labels.sheetTypes[type]}</span></p>
            {labels.warnings && sheet.warnings?.formulasWithoutValue && sheet.warnings.formulasWithoutValue.count > 0 && <p role="note" className="mt-1 text-xs text-amber-700">{labels.warnings.noValue.replace('{n}', String(sheet.warnings.formulasWithoutValue.count)).replace('{cells}', sheet.warnings.formulasWithoutValue.samples.join(', '))}</p>}
            {labels.warnings && sheet.warnings?.formulaErrors && sheet.warnings.formulaErrors.count > 0 && <p role="note" className="mt-1 text-xs text-red-700">{labels.warnings.errors.replace('{n}', String(sheet.warnings.formulaErrors.count)).replace('{cells}', sheet.warnings.formulaErrors.samples.join(', '))}</p>}
            {labels.aliasPrefix && (prefixHints[sheet.name] ?? []).map(hint => <label key={hint.from} className="mt-2 flex items-start gap-2 text-xs text-amber-800"><input type="checkbox" checked={refAliases[sheet.name]?.[hint.from] === hint.to} onChange={event => setRefAliases(previous => { const current = { ...(previous[sheet.name] ?? {}) }; if (event.target.checked) current[hint.from] = hint.to; else delete current[hint.from]; return { ...previous, [sheet.name]: current } })} /><span>{labels.aliasPrefix!.replace(/\{from\}/g, hint.from).replace(/\{to\}/g, hint.to)}</span></label>)}
            <label className="mt-3 block text-xs font-medium text-gray-700">{sheet.name} — {labels.sheetRole}
              <select aria-label={`${sheet.name} — ${labels.sheetRole}`} value={type} onChange={event => { const role = event.target.value as HistoricSheetType; setSheetTypes(previous => ({ ...previous, [sheet.name]: role })); if (isAtelierRole(role) && !(ATELIER_ROLE_FIELDS[role] ?? []).some(field => mappings[sheet.name]?.[field])) setMappings(previous => ({ ...previous, [sheet.name]: suggestAtelierMapping(role, sheet.columns) })) }} className="input mt-1 block w-full text-sm">
                <option value="UNKNOWN">{labels.ignoreSheet}</option>
                {Object.entries(labels.sheetTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {labels.valueMap && (type === 'RISK_SOURCES' || type === 'STAKEHOLDERS') && (() => {
              const field = type === 'RISK_SOURCES' ? 'category' : 'type'
              const column = splitHistoricMappedColumns(mappings[sheet.name]?.[type === 'RISK_SOURCES' ? 'title' : 'type'])[0]
              const distinct = column ? sheet.profiles?.[column]?.values ?? [] : []
              if (distinct.length === 0) return null
              const targets = labels.valueMap![field] ?? {}
              const dictionary = suggestValueMap(distinct, type === 'RISK_SOURCES' ? 'sourceCategory' : 'stakeholderType')
              return <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 p-2 text-xs dark:border-amber-300/40 dark:bg-amber-950/40" data-testid={`value-map-${sheet.name}`}>
                <p className="font-semibold">{labels.valueMap!.title}</p><p className="text-gray-600">{labels.valueMap!.hint}</p>
                <div className="mt-2 space-y-1">{distinct.map(source => {
                  const chosen = valueMaps[sheet.name]?.[field]?.[source] ?? dictionary[source] ?? 'AUTRE'
                  return <label key={source} className="flex items-center justify-between gap-2">{source}
                    <select aria-label={`${sheet.name} — ${source}`} value={chosen} onChange={event => setValueMaps(previous => ({ ...previous, [sheet.name]: { ...previous[sheet.name], [field]: { ...(previous[sheet.name]?.[field] ?? {}), [source]: event.target.value } } }))} className="input text-xs">
                      {Object.entries(targets).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select></label>
                })}</div></div>
            })()}
            {type !== 'UNKNOWN' && <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {fields.map(field => {
                const required = field === 'title' && type !== 'RESIDUAL_RISKS' || field === 'riskRef' && type === 'RESIDUAL_RISKS' || type === 'RISK_ACTION_LINKS' || (type === 'VULNERABILITIES' && field === 'riskExternalId') || (type === 'RISKS' && field === 'externalId' && Boolean(mappings[sheet.name]?.embeddedVulnerabilities || mappings[sheet.name]?.embeddedActions))
                const value = mappings[sheet.name]?.[field] ?? ''
                const compatibility = field === 'description' && value ? 'COMPATIBLE' : getHistoricColumnCompatibility(field, value, required)
                const selectedColumns = splitHistoricMappedColumns(value)
                const profile = selectedColumns.length === 1 ? sheet.profiles?.[selectedColumns[0]] : undefined
                const profileValidation = profile ? validateHistoricColumnProfile(field, profile, field === 'status' ? statusMappings[sheet.name] : field === 'gravity' || field === 'likelihood' ? scoreMappings[sheet.name]?.[field] : undefined) : undefined
                const hasInvalidValues = Boolean(field !== 'status' && profileValidation && profileValidation.invalidCount > 0)
                const indicator = hasInvalidValues || compatibility === 'MISSING' ? '✕' : compatibility === 'COMPATIBLE' ? '✓' : '⚠'
                const indicatorClass = hasInvalidValues || compatibility === 'MISSING' ? 'text-red-700' : compatibility === 'COMPATIBLE' ? 'text-green-700' : 'text-amber-700'
                const supportsList = field === 'embeddedVulnerabilities' || field === 'embeddedActions' || type === 'RISK_ACTION_LINKS' && (field === 'riskExternalId' || field === 'actionExternalId') || field === 'title' && (type === 'VULNERABILITIES' || type === 'MEASURES' || type === 'ACTIONS')
                const supportsCarryForward = field === 'externalId' || field === 'riskExternalId' || field === 'analysisExternalId'
                return <label key={field} className="text-xs font-medium text-gray-700">
                  <span>{validationLabels.acraField} — {field === 'externalId' ? validationLabels.externalReference : labels.fieldLabels[field] ?? field}</span>
                  {required && <span className="ml-1 inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">{labels.missing}</span>}
                  <span className="ml-1 font-semibold" aria-label={`${labels.fieldLabels[field] ?? field}: ${hasInvalidValues ? 'INVALID' : compatibility}`}><span aria-hidden className={indicatorClass}>{indicator}</span></span>
                  <span className="mt-1 block text-[11px] font-normal text-gray-500">{validationLabels.sourceColumn}</span>
                  {field === 'description' ? <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-sm border border-gray-200 p-2">{sheet.columns.map(column => <label key={column} className="flex items-center gap-2 font-normal"><input type="checkbox" checked={selectedColumns.includes(column)} onChange={event => { const selected = event.target.checked ? [...selectedColumns, column] : selectedColumns.filter(item => item !== column); setMappings(prev => ({ ...prev, [sheet.name]: { ...prev[sheet.name], [field]: selected.join(HISTORIC_MULTI_COLUMN_SEPARATOR) || undefined } })) }} />{column}</label>)}</div> : <select aria-label={`${sheet.name} — ${labels.fieldLabels[field] ?? field}`} value={value} onChange={event => setMappings(prev => ({ ...prev, [sheet.name]: { ...prev[sheet.name], [field]: event.target.value || undefined } }))} className="input w-full text-sm"><option value="">—</option>{sheet.columns.map(column => <option key={column} value={column}>{column}</option>)}</select>}
                  <span className="mt-1 block font-normal text-gray-500">{validationLabels.expected}: {profileValidation?.expected ?? validateHistoricColumnProfile(field, { examples: [], values: [], total: 0, numeric1to4Count: 0, isoDateCount: 0, measureStatusCount: 0, strategyCount: 0 }).expected}</span>
                  {profile && <span className={hasInvalidValues ? 'mt-1 block font-normal text-red-700' : 'mt-1 block font-normal text-gray-500'}>{hasInvalidValues ? `${profileValidation!.invalidCount}/${profileValidation!.total} ${validationLabels.invalidValues}` : compatibility === 'COMPATIBLE' ? validationLabels.compatible : validationLabels.review} · {validationLabels.examples}: {profile.examples.join(', ') || '—'}</span>}
                  {field === 'status' && profile && <div className="mt-2 space-y-1 rounded-sm border border-amber-200 bg-amber-50 p-2 font-normal">{profile.values.map(source => <label key={source} className="flex items-center justify-between gap-2">{source}<select value={statusMappings[sheet.name]?.[source] ?? ''} onChange={event => setStatusMappings(previous => ({ ...previous, [sheet.name]: { ...previous[sheet.name], [source]: event.target.value } }))} className="input text-xs"><option value="">—</option><option value="A_FAIRE">À faire</option><option value="EN_COURS">En cours</option><option value="REALISE">Réalisé</option><option value="REPORTE">Reporté</option></select></label>)}</div>}
                  {(field === 'gravity' || field === 'likelihood') && profile && <div className="mt-2 space-y-1 rounded-sm border border-amber-200 bg-amber-50 p-2 font-normal">{profile.values.map(source => <label key={source} className="flex items-center justify-between gap-2">{source}<select value={scoreMappings[sheet.name]?.[field]?.[source] ?? ''} onChange={event => setScoreMappings(previous => ({ ...previous, [sheet.name]: { ...previous[sheet.name], [field]: { ...previous[sheet.name]?.[field], [source]: event.target.value } } }))} className="input text-xs"><option value="">—</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>)}</div>}
                  {supportsList && labels.listTransform && <span className="mt-2 block font-normal"><span className="text-[11px] text-gray-500">{labels.listTransform.label}</span><select aria-label={`${sheet.name} — ${labels.fieldLabels[field] ?? field} — ${labels.listTransform.label}`} className="input mt-1 w-full text-xs" value={transforms[sheet.name]?.[field]?.mode ?? ''} onChange={event => setTransforms(previous => ({ ...previous, [sheet.name]: { ...previous[sheet.name], [field]: event.target.value ? { ...previous[sheet.name]?.[field], mode: event.target.value as HistoricValueTransform['mode'] } : previous[sheet.name]?.[field]?.carryForward ? { carryForward: true } : undefined } }))}><option value="">{labels.listTransform.none}</option><option value="LINES">{labels.listTransform.lines}</option><option value="SEMICOLON">{labels.listTransform.semicolon}</option><option value="PIPE">{labels.listTransform.pipe}</option></select></span>}
                  {supportsCarryForward && labels.listTransform?.carryForward && <label className="mt-2 flex items-center gap-2 font-normal"><input type="checkbox" checked={Boolean(transforms[sheet.name]?.[field]?.carryForward)} onChange={event => setTransforms(previous => ({ ...previous, [sheet.name]: { ...previous[sheet.name], [field]: event.target.checked ? { ...previous[sheet.name]?.[field], carryForward: true } : undefined } }))} />{labels.listTransform.carryForward}</label>}
                </label>
              })}
            </div>}
          </div>
        })}
      </div>}
      {incompleteRowEntries.length > 0 && completion?.importableTitle && importableByObject.length > 0 && <section className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-950 dark:border-green-700 dark:bg-green-950/40 dark:text-green-100" aria-label={completion.importableTitle}>
        <h3 className="font-semibold">{completion.importableTitle}</h3>
        <ul className="mt-2 space-y-1">{importableByObject.map(item => <li key={item.role}><span className="font-medium">{(labels.sheetTypes as Record<string, string | undefined>)[item.role] ?? item.role}</span> : {(completion.importableReady ?? '{n}').replace('{n}', String(item.ready))}{item.toDecide > 0 && <> · {(completion.importableToDecide ?? '{n}').replace('{n}', String(item.toDecide))}</>}{item.template > 0 && <> · {(completion.importableTemplate ?? '{n}').replace('{n}', String(item.template))}</>}</li>)}</ul>
      </section>}
      {incompleteRowEntries.length > 0 && completion && <section className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-400/60 dark:bg-amber-950/50 dark:text-amber-50" aria-label={completion.title}>
        <h3 className="font-semibold">{completion.title}</h3>
        <p className="mt-1">{completion.explanation}</p>
        <div className="mt-3 space-y-3">
          {Object.entries(incompleteBySheet).map(([sheetName, entries]) => entries.length <= INCOMPLETE_GROUP_THRESHOLD
            ? entries.map(renderIncompleteRow)
            : <div key={sheetName} className="rounded-sm border border-amber-300 bg-white p-3 text-gray-900 dark:border-amber-300/40 dark:bg-slate-900 dark:text-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{(completion.groupSummary ?? '{sheet} — {n}').replace('{sheet}', sheetName).replace('{n}', String(entries.length))}</p>
                <button type="button" className="btn-secondary text-xs" onClick={() => setRowActions(previous => ({ ...previous, ...Object.fromEntries(entries.map(([key]) => [key, 'SKIP' as const])) }))}>{(completion.skipAll ?? completion.skip).replace('{n}', String(entries.length))}</button>
              </div>
              <p role="status" data-testid={`group-status-${sheetName}`} className="mt-2 text-xs">{entries.filter(([key]) => rowActions[key] !== 'COMPLETE').length} {completion.skipSummary} · {entries.filter(([key]) => rowActions[key] === 'COMPLETE').length} {completion.completeSummary}</p>
              <details className="mt-2"><summary className="cursor-pointer text-xs font-medium underline">{completion.perRow ?? completion.complete}</summary>
                <div className="mt-3 space-y-3">{entries.map(renderIncompleteRow)}</div>
              </details>
            </div>)}
        </div>
        <p className="mt-3 text-xs">{skippedRows.length} {completion.skipSummary} · {completedRows.length} {completion.completeSummary}</p>
      </section>}
      <div data-testid="historic-import-footer" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
        {blockers.length > 0 ? <ul role="alert" className="list-inside list-disc text-xs text-red-800">{blockers.map(blocker => <li key={`${blocker.sheetName}:${blocker.field}`}>✕ {blocker.sheetName} — ACRA : {blocker.field === '__RISK_SHEET__' ? labels.sheetTypes.RISKS : blocker.field === '__ACTION_SHEET__' ? labels.sheetTypes.ACTIONS : labels.fieldLabels[blocker.field] ?? blocker.field} ({labels.missing})</li>)}</ul> : <span />}
        <button type="button" className="btn-primary inline-flex items-center gap-2" aria-busy={busy} disabled={selectedSheets.length === 0 || invalid || completionIncomplete || busy} onClick={() => {
          if (submitting.current) return
          submitting.current = true; setSubmitted(true)
          Promise.resolve(onConfirm({ mappings, sheetTypes, transforms, statusMappings, scoreMappings, rowOverrides, refAliases: Object.fromEntries(Object.entries(refAliases).filter(([, v]) => Object.keys(v).length)), valueMaps: Object.fromEntries(Object.entries(valueMaps).map(([sheetName, fields]) => [sheetName, Object.fromEntries(Object.entries(fields).filter(([, m]) => Object.keys(m).length))]).filter(([, f]) => Object.keys(f as object).length)), organizationId: targetOrganizationId || undefined })).catch(() => {}).finally(() => { submitting.current = false; setSubmitted(false) })
        }}>{busy && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-90" /></svg>}{busy ? (labels.importing ?? labels.confirm) : labels.confirm}</button>
      </div>
    </section>
  )
}
