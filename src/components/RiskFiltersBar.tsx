'use client'

import { useTranslation } from '@/lib/i18n/context'
import { taxonomieLabel, type TaxonomieNode } from '@/lib/taxonomie'
import { RISK_STATUTS } from '@/lib/risk-item'
import { activeFilterCount, type RiskFilters } from '@/lib/risk-filters'

// Barre de filtres partagée (cartographie / pilotage) — pilotée par le parent.
export default function RiskFiltersBar({
  filters, onChange, taxo, tr, processus, entites, onExport,
}: {
  filters: RiskFilters
  onChange: (f: RiskFilters) => void
  taxo: TaxonomieNode[]
  tr: (key: string) => string
  processus: { id: string; nom: string }[]
  entites: string[]
  /** Déclenche le téléchargement dans le format demandé. */
  onExport?: (format: 'csv' | 'xlsx' | 'pdf') => void
}) {
  const { t } = useTranslation()
  const f = t.filtres
  const r = t.registre
  const n = activeFilterCount(filters)
  const set = (patch: Partial<RiskFilters>) => onChange({ ...filters, ...patch })
  const sel = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'

  return (
    <div className="card p-3 mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          {f.title}{n > 0 && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-ebios-100 text-ebios-700">{n}</span>}
        </span>

        <select value={filters.taxonomieCode ?? ''} onChange={e => set({ taxonomieCode: e.target.value || null })} className={sel} aria-label={r.colCategory}>
          <option value="">{f.allCategories}</option>
          {taxo.filter(x => x.actif !== false).map(x => <option key={x.code} value={x.code}>{taxonomieLabel(x, tr)}</option>)}
        </select>

        <select value={filters.processusId ?? ''} onChange={e => set({ processusId: e.target.value || null })} className={sel} aria-label={r.colProcess}>
          <option value="">{f.allProcesses}</option>
          {processus.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>

        <select value={filters.entite ?? ''} onChange={e => set({ entite: e.target.value || null })} className={sel} aria-label={f.allEntities}>
          <option value="">{f.allEntities}</option>
          {entites.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <select value={filters.statut ?? ''} onChange={e => set({ statut: e.target.value || null })} className={sel} aria-label={r.colStatut}>
          <option value="">{f.allStatuses}</option>
          {RISK_STATUTS.map(s => <option key={s} value={s}>{(r.statuts as Record<string, string>)[s] ?? s}</option>)}
        </select>

        <select value={filters.niveau ?? ''} onChange={e => set({ niveau: e.target.value || null })} className={sel} aria-label={f.allLevels}>
          <option value="">{f.allLevels}</option>
          <option value="eleve">{f.levels.eleve}</option>
          <option value="moyen">{f.levels.moyen}</option>
          <option value="faible">{f.levels.faible}</option>
          <option value="nonCote">{f.levels.nonCote}</option>
        </select>

        {n > 0 && <button onClick={() => onChange({ mode: filters.mode })} className="text-xs text-gray-500 hover:text-gray-700 underline">{f.reset}</button>}

        <div className="flex-1" />
        {onExport && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">{f.exportLabel}</span>
            <button onClick={() => onExport('csv')} className="btn-secondary text-xs">{f.csv}</button>
            <button onClick={() => onExport('xlsx')} className="btn-secondary text-xs">{f.xlsx}</button>
            <button onClick={() => onExport('pdf')} className="btn-secondary text-xs">{f.pdf}</button>
          </div>
        )}
      </div>
    </div>
  )
}
