'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { taxonomieLabel, type TaxonomieNode } from '@/lib/taxonomie'
import {
  buildHeatmap, aggregateByDimension, CARTO_MAX,
  type CartoRisk, type CartoMode, type CartoDimension, type NiveauBucket,
} from '@/lib/cartographie'
import { applyFilters, distinctEntites, filtersToQuery, type RiskFilters } from '@/lib/risk-filters'
import RiskFiltersBar from '@/components/RiskFiltersBar'

type PublishAnalyse = { id: string; nom: string; organisation: string | null; risquesCount: number; dejaPublies: number }

// Le registre renvoie aussi statut et niveaux calculés : nécessaires au filtrage.
type FilterableCartoRisk = CartoRisk & {
  statut: string
  niveauInherent: number | null
  niveauResiduel: number | null
}

const BUCKET_BG: Record<NiveauBucket, string> = {
  faible: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  moyen: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  eleve: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
}
// Fond des cellules de la heat map, gradué par palier (vide = neutre).
function cellBg(bucket: NiveauBucket | null, empty: boolean): string {
  if (empty) return 'bg-gray-50 dark:bg-gray-800/40'
  return bucket ? BUCKET_BG[bucket] : 'bg-gray-100'
}

export default function Cartographie({ canPublish }: { canPublish: boolean }) {
  const { t, locale } = useTranslation()
  const c = t.cartographie
  const [risks, setRisks] = useState<FilterableCartoRisk[]>([])
  const [taxo, setTaxo] = useState<TaxonomieNode[]>([])
  const [procs, setProcs] = useState<{ id: string; nom: string }[]>([])
  const [analyses, setAnalyses] = useState<PublishAnalyse[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<CartoMode>('residual')
  const [dimension, setDimension] = useState<CartoDimension>('taxonomie')
  const [filters, setFilters] = useState<RiskFilters>({ mode: 'residual' })
  const [publishing, setPublishing] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const tr = useMemo(() => (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string ?? '', [t])

  async function reload() {
    const [rr, tt, pp, aa] = await Promise.all([
      fetch('/api/risk-items').then(x => x.ok ? x.json() : { risks: [] }),
      fetch('/api/taxonomie').then(x => x.ok ? x.json() : { taxonomie: [] }),
      fetch('/api/processus').then(x => x.ok ? x.json() : { processus: [] }),
      canPublish ? fetch('/api/risk-items/publish').then(x => x.ok ? x.json() : { analyses: [] }) : Promise.resolve({ analyses: [] }),
    ])
    setRisks(rr.risks ?? []); setTaxo(tt.taxonomie ?? []); setProcs(pp.processus ?? []); setAnalyses(aa.analyses ?? [])
    setLoading(false)
  }
  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Le mode (inhérent/résiduel) pilote aussi l'évaluation du filtre de niveau.
  const shown = useMemo(() => applyFilters(risks, { ...filters, mode }), [risks, filters, mode])
  const entites = useMemo(() => distinctEntites(risks), [risks])

  const heat = useMemo(() => buildHeatmap(shown, mode), [shown, mode])
  const cellIndex = useMemo(() => {
    const m = new Map<string, typeof heat.cells[number]>()
    heat.cells.forEach(cell => m.set(`${cell.gravite}:${cell.vraisemblance}`, cell))
    return m
  }, [heat])
  const buckets = useMemo(() => aggregateByDimension(shown, dimension, mode), [shown, dimension, mode])

  // Export du périmètre AFFICHÉ (filtres + mode) ; `lang` localise le rapport PDF.
  function exportAs(format: 'csv' | 'xlsx' | 'pdf') {
    const p = new URLSearchParams(filtersToQuery({ ...filters, mode }))
    p.set('format', format)
    if (format === 'pdf') p.set('lang', locale)
    window.location.href = `/api/risk-items/export?${p.toString()}`
  }

  function dimLabel(key: string, label: string | null): string {
    if (key === '') return c.nonRenseigne
    if (dimension === 'taxonomie') {
      const node = taxo.find(n => n.code === key)
      return node ? taxonomieLabel(node, tr) : key
    }
    return label ?? key
  }

  async function publier(id: string) {
    setPublishing(id); setFlash(null)
    const res = await fetch('/api/risk-items/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analyseId: id }) })
    const data = await res.json().catch(() => ({}))
    setPublishing(null)
    if (res.ok) { setFlash(c.publishOk.replace('{crees}', String(data.crees)).replace('{maj}', String(data.maj))); reload() }
    else setFlash(c.publishErr)
  }

  const gravites = Array.from({ length: CARTO_MAX }, (_, i) => CARTO_MAX - i) // 5..1 (haut → bas)
  const vraisemblances = Array.from({ length: CARTO_MAX }, (_, i) => i + 1)   // 1..5 (gauche → droite)
  const toggle = 'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors'
  const on = 'bg-ebios-100 text-ebios-700 dark:bg-ebios-500/20 dark:text-ebios-200'
  const off = 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">🗺️ {c.title}</h1>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button className={`${toggle} ${mode === 'inherent' ? on : off}`} onClick={() => setMode('inherent')}>{c.inherent}</button>
          <button className={`${toggle} ${mode === 'residual' ? on : off}`} onClick={() => setMode('residual')}>{c.residual}</button>
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{c.subtitle}</p>

      {loading ? <p className="text-gray-400">…</p> : (
        <>
          <RiskFiltersBar
            filters={filters} onChange={setFilters} taxo={taxo} tr={tr}
            processus={procs} entites={entites} onExport={exportAs}
          />

          {/* Bandeau de synthèse (sur le périmètre filtré) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Stat label={c.total} value={shown.length} />
            <Stat label={c.eleves} value={heat.parBucket.eleve} tone="eleve" />
            <Stat label={c.moyens} value={heat.parBucket.moyen} tone="moyen" />
            <Stat label={c.nonCotes} value={heat.totalNonCote} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Heat map gravité × vraisemblance */}
            <div className="card p-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{c.heatmapTitle}</p>
              <div className="flex">
                <div className="flex flex-col justify-around pr-2 text-[10px] font-medium text-gray-400 uppercase"><span className="[writing-mode:vertical-rl] rotate-180 self-center">{c.axisGravite}</span></div>
                <div className="flex-1">
                  <div className="grid" style={{ gridTemplateColumns: `auto repeat(${CARTO_MAX}, 1fr)` }}>
                    {gravites.map(g => (
                      <div key={g} className="contents">
                        <div className="flex items-center justify-center text-xs text-gray-400 font-medium pr-1">{g}</div>
                        {vraisemblances.map(v => {
                          const cell = cellIndex.get(`${g}:${v}`)
                          const n = cell?.risqueIds.length ?? 0
                          return (
                            <div key={v} title={`G${g} × V${v} — ${n}`} className={`aspect-square m-0.5 rounded flex items-center justify-center text-sm font-bold ${cellBg(cell?.bucket ?? null, n === 0)}`}>
                              {n > 0 ? n : ''}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                    <div className="flex items-center justify-center text-xs text-gray-400 pr-1" />
                    {vraisemblances.map(v => <div key={v} className="flex items-center justify-center text-xs text-gray-400 font-medium pt-1">{v}</div>)}
                  </div>
                  <p className="text-center text-[10px] font-medium text-gray-400 uppercase mt-1">{c.axisVraisemblance}</p>
                </div>
              </div>
            </div>

            {/* Ventilation par dimension */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{c.ventilationTitle}</p>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                  {(['taxonomie', 'processus', 'entite'] as CartoDimension[]).map(d => (
                    <button key={d} className={`${toggle} text-xs ${dimension === d ? on : off}`} onClick={() => setDimension(d)}>{c.dim[d]}</button>
                  ))}
                </div>
              </div>
              {buckets.length === 0 ? <p className="text-sm text-gray-400 italic py-4">{c.empty}</p> : (
                <ul className="space-y-2">
                  {buckets.map(b => (
                    <li key={b.key || '__none'} className="flex items-center gap-3">
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">{dimLabel(b.key, b.label)}</span>
                      <span className="text-xs text-gray-400">{b.count}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium min-w-[2rem] text-center ${b.pireBucket ? BUCKET_BG[b.pireBucket] : 'bg-gray-100 text-gray-400'}`}>{b.maxNiveau ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Publication depuis les analyses ACRA approuvées */}
          {canPublish && (
            <div className="card p-4 mt-6">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">{c.publishTitle}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{c.publishSubtitle}</p>
              {flash && <p className="text-xs text-ebios-600 mb-2">{flash}</p>}
              {analyses.length === 0 ? <p className="text-sm text-gray-400 italic">{c.publishEmpty}</p> : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {analyses.map(a => (
                    <li key={a.id} className="flex items-center gap-3 py-2">
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">{a.nom}{a.organisation && <span className="text-xs text-gray-400"> · {a.organisation}</span>}</span>
                      <span className="text-xs text-gray-400">{c.publishCount.replace('{n}', String(a.risquesCount))}</span>
                      {a.dejaPublies > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300">{c.publishDone.replace('{n}', String(a.dejaPublies))}</span>}
                      <button onClick={() => publier(a.id)} disabled={publishing === a.id} className="btn-secondary text-xs disabled:opacity-50">{publishing === a.id ? '…' : (a.dejaPublies > 0 ? c.publishAgain : c.publishBtn)}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: NiveauBucket }) {
  const color = tone === 'eleve' ? 'text-red-600 dark:text-red-400' : tone === 'moyen' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-100'
  return (
    <div className="card p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
