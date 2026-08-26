'use client'

import { useState, useEffect, useRef } from 'react'
import { ATELIER_ICONS } from '@/lib/atelier-icons'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ATELIERS_META } from '@/lib/ebios-data'
import { getRiskTier } from '@/lib/risk-scale'
import { useTranslation } from '@/lib/i18n/context'
import { formatDate } from '@/lib/format'
import { AlertCircle, AlertTriangle, ArrowDown, Calendar, CheckCircle2, Circle, ClipboardList, Clock, Download, FileJson, FileSpreadsheet, FileText, FolderOpen, Landmark, Link2, Pencil, Search, Settings, ShieldCheck, Sparkles, Trash2, Trophy, Upload, VenetianMask } from 'lucide-react'
import { filtrerParTag, tagsUniques } from '@/lib/analyse-tags'
import ConfirmDialog from '@/components/ConfirmDialog'
import ExpressAnalyseButton from '@/components/ExpressAnalyseButton'

type FilterValue = 'ALL' | 'EN_COURS' | 'TERMINE' | 'SOUMIS' | 'APPROUVE'

function urlParamToFilter(p: string | null): FilterValue {
  switch (p) {
    case 'en_cours': return 'EN_COURS'
    case 'termine':  return 'TERMINE'
    case 'soumis':   return 'SOUMIS'
    case 'approuve': return 'APPROUVE'
    default:         return 'ALL'
  }
}

/**
 * Liste des analyses — partie interactive (recherche, filtre, import, suppression).
 * Les données initiales sont chargées côté SERVEUR (issue #104) : premier rendu
 * instantané, sans FOUC réseau ; on rafraîchit ensuite localement après import/suppr.
 */
export default function AnalysesClient({ initialAnalyses, demo = false }: { initialAnalyses: any[]; demo?: boolean }) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [analyses, setAnalyses] = useState<any[]>(initialAnalyses)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterValue>(() => urlParamToFilter(searchParams.get('filter')))
  const [tagFilter, setTagFilter] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [loadingExample, setLoadingExample] = useState(false)

  // Site de démo : charge un exemple complet dans l'organisation du testeur.
  async function loadExample() {
    setLoadingExample(true)
    try {
      const res = await fetch('/api/demo/load-example', { method: 'POST' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erreur')
      if (result.analyseId) router.push(`/analyses/${result.analyseId}`)
      else router.refresh()
    } catch (err: any) {
      alert(`Erreur : ${err.message}`)
      setLoadingExample(false)
    }
  }
  // Sync filtre avec l'URL
  useEffect(() => {
    setFilter(urlParamToFilter(searchParams.get('filter')))
  }, [searchParams])

  function handleFilterChange(value: FilterValue) {
    setFilter(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'ALL') {
      params.delete('filter')
    } else {
      params.set('filter', value.toLowerCase())
    }
    router.replace(`/analyses${params.size ? `?${params}` : ''}`, { scroll: false })
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const isCSV = file.name.endsWith('.csv')
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: text, format: isCSV ? 'csv' : 'json' }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erreur import')
      // Reload analyses list
      const d = await fetch('/api/analyses').then(r => r.json())
      setAnalyses(d.analyses || [])
      alert(`✅ Analyse importée : "${result.nom}"`)
    } catch (err: any) {
      alert(`Erreur : ${err.message}`)
    }
    setImporting(false)
    if (importRef.current) importRef.current.value = ''
  }

  async function confirmDeleteAnalyse(id: string) {
    setDeleting(id)
    setPendingDelete(null)
    await fetch(`/api/analyses/${id}`, { method: 'DELETE' })
    setAnalyses(prev => prev.filter(a => a.id !== id))
    setDeleting(null)
  }

  // Tri : max niveau risque desc, puis nombre de risques desc, puis updatedAt desc
  const sorted = [...analyses].sort((a, b) => {
    const maxA = a.risques?.length ? Math.max(...a.risques.map((r: any) => r.niveauRisque)) : 0
    const maxB = b.risques?.length ? Math.max(...b.risques.map((r: any) => r.niveauRisque)) : 0
    if (maxB !== maxA) return maxB - maxA
    if (b._count.risques !== a._count.risques) return b._count.risques - a._count.risques
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  const allTags = tagsUniques(analyses)
  const filtered = filtrerParTag(sorted, tagFilter)
    .filter(a => filter === 'ALL' || a.statut === filter)
    .filter(a =>
      !search ||
      a.nom.toLowerCase().includes(search.toLowerCase()) ||
      (a.organisation || '').toLowerCase().includes(search.toLowerCase())
    )

  return (
    <>
      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.analyses.title}</h1>
            <p className="text-gray-500 text-sm mt-1">{analyses.length} {analyses.length === 1 ? t.analyses.totalLabelSg : t.analyses.totalLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Import */}
            <input
              ref={importRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={handleImport}
              aria-label="Importer une analyse"
            />
            <button
              onClick={() => importRef.current?.click()}
              disabled={importing}
              className="btn-secondary flex items-center gap-2 text-sm"
              title="Importer une analyse depuis un fichier JSON ou CSV"
            >
              {importing ? <><Clock size={12} className="inline align-[-0.15em] mr-1" aria-hidden="true" />Import…</> : <><FolderOpen size={12} className="inline align-[-0.15em] mr-1" aria-hidden="true" />Importer</>}
            </button>
            <ExpressAnalyseButton variant="button" />
            {demo && (
              <button
                onClick={loadExample}
                disabled={loadingExample}
                className="btn-secondary flex items-center gap-2 text-sm"
                title={t.demo.loadExampleHint}
              >
                {loadingExample ? <><Clock size={12} className="inline align-[-0.15em] mr-1" aria-hidden="true" />…</> : <><Sparkles size={12} className="inline align-[-0.15em] mr-1" aria-hidden="true" />{t.demo.loadExample}</>}
              </button>
            )}
            <Link href="/analyses/new" className="btn-primary flex items-center gap-2">
              {t.analyses.newBtn}
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.analyses.searchPh}
            className="input max-w-xs text-sm"
          />
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { value: 'ALL',      label: t.analyses.filterAll       },
              { value: 'EN_COURS', label: t.analyses.filterActive    },
              { value: 'SOUMIS',   label: t.analyses.filterSubmitted },
              { value: 'TERMINE',  label: t.analyses.filterDone      },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => handleFilterChange(f.value as FilterValue)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.value ? 'bg-white shadow-sm text-ebios-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {allTags.length > 0 && (
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
              className="input max-w-[12rem] text-sm" aria-label={t.analyses.tagFilterLabel}>
              <option value="">{t.analyses.tagFilterAll}</option>
              {allTags.map(tg => <option key={tg} value={tg}>{tg}</option>)}
            </select>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4"><Search size={40} aria-hidden="true" /></div>
            <p className="text-gray-500">{t.analyses.notFound}</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link href="/analyses/new" className="btn-primary inline-block">{t.analyses.createBtn}</Link>
              {demo && (
                <button onClick={loadExample} disabled={loadingExample} className="btn-secondary">
                  {loadingExample ? <><Clock size={12} className="inline align-[-0.15em] mr-1" aria-hidden="true" />…</> : <><Sparkles size={12} className="inline align-[-0.15em] mr-1" aria-hidden="true" />{t.demo.loadExample}</>}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(a => {
              const _ai = Math.min(a.atelierCourant - 1, 4)
              const atelier = { ...ATELIERS_META[_ai], ...((t.ateliersMeta as any)[_ai] ?? {}) }
              const pct = Math.round((a.atelierCourant / 5) * 100)
              const maxRisk = a.risques?.length ? Math.max(...a.risques.map((r: any) => r.niveauRisque)) : 0
              const critiques = a.risques?.filter((r: any) => getRiskTier(r.niveauRisque) === 'critique').length ?? 0

              const maxTier = getRiskTier(maxRisk)
              const riskBadge = maxTier === 'critique'
                ? { label: <><AlertCircle size={12} className="inline align-[-0.15em] mr-1" aria-hidden="true" />{`${critiques} ${critiques === 1 ? t.analyses.riskSg : t.analyses.risks}`}</>, cls: 'bg-red-100 text-red-700',    href: '/risques?niveau=critique' }
                : maxTier === 'eleve'
                  ? { label: <><Circle size={10} className="inline align-[-0.1em] mr-1 fill-current" aria-hidden="true" />{`élevé (${maxRisk})`}</>,    cls: 'bg-orange-100 text-orange-700', href: '/risques?niveau=eleve' }
                  : maxTier === 'modere'
                    ? { label: <><Circle size={10} className="inline align-[-0.1em] mr-1 fill-current" aria-hidden="true" />{`modéré (${maxRisk})`}</>, cls: 'bg-yellow-100 text-yellow-700', href: '/risques?niveau=modere' }
                    : null

              // Mesures P1 à faire
              const mesuresP1AFaire = (a.mesures ?? []).filter((m: any) => m.priorite === 1 && m.statut === 'A_FAIRE').length
              // Risques avec stratégie "à réduire" non encore traités
              const risquesReduire = (a.risques ?? []).filter((r: any) => r.strategie === 'REDUIRE').length

              const statutBadge = {
                TERMINE:  { label: <><CheckCircle2 size={12} className="inline align-[-0.15em] mr-1" aria-hidden="true" />{t.analyses.doneStatus}</>,           cls: 'bg-green-100 text-green-700'   },
                APPROUVE: { label: <><Trophy size={12} className="inline align-[-0.15em] mr-1" aria-hidden="true" />{t.statut.APPROUVE}</>,               cls: 'bg-teal-100 text-teal-700'    },
                SOUMIS:   { label: <><Upload size={12} className="inline align-[-0.15em] mr-1" aria-hidden="true" />{t.statut.SOUMIS}</>,                 cls: 'bg-blue-100 text-blue-700'    },
                EN_COURS: { label: <><Settings size={12} className="inline align-[-0.15em] mr-1" aria-hidden="true" />{t.analyses.inProgStatus}</>,         cls: 'bg-orange-100 text-orange-700' },
              }[a.statut as string] ?? { label: a.statut, cls: 'bg-gray-100 text-gray-700' }

              return (
                <div
                  key={a.id}
                  className="card p-5 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/analyses/${a.id}`)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-gray-900 text-lg">{a.nom}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutBadge.cls}`}>
                          {statutBadge.label}
                        </span>
                        {riskBadge && (
                          <Link
                            href={riskBadge.href}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium hover:opacity-80 transition-opacity ${riskBadge.cls}`}
                            onClick={e => e.stopPropagation()}
                          >
                            {riskBadge.label}
                          </Link>
                        )}
                        {risquesReduire > 0 && (
                          <Link
                            href="/risques"
                            className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 hover:opacity-80 transition-opacity"
                            onClick={e => e.stopPropagation()}
                          >
                            <ArrowDown size={13} className="inline align-[-0.15em] mr-1" aria-hidden="true" />{risquesReduire} {risquesReduire === 1 ? t.analyses.riskSg : t.analyses.risks} à réduire
                          </Link>
                        )}
                        {mesuresP1AFaire > 0 && (
                          <Link
                            href="/actions?priorite=1"
                            className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 hover:opacity-80 transition-opacity"
                            onClick={e => e.stopPropagation()}
                          >
                            <ShieldCheck size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {mesuresP1AFaire} P1 à faire
                          </Link>
                        )}
                        {(a as any).isSocle && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                            <Landmark size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> Socle
                          </span>
                        )}
                        {(a as any).socle && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-600">
                            <Link2 size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {(a as any).socle.nom}
                          </span>
                        )}
                      </div>
                      {(a.organisation || a.secteur) && (
                        <div className="text-sm text-gray-500 mb-2">
                          {[a.organisation, a.secteur].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {Array.isArray(a.tags) && a.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {a.tags.map((tg: string) => (
                            <button key={tg} type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setTagFilter(tg) }}
                              className="text-[11px] px-2 py-0.5 rounded-full bg-ebios-50 text-ebios-700 hover:bg-ebios-100 font-medium">{tg}</button>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3 flex-wrap">
                        <span><span aria-hidden="true"><Calendar size={18} aria-hidden="true" /></span>{t.analyses.created} {formatDate(a.createdAt, locale)}</span>
                        <span><Pencil size={12} className="inline align-[-0.15em] mr-1" aria-hidden="true" />{t.analyses.modified} {formatDate(a.updatedAt, locale)}</span>
                        <span><VenetianMask size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {a._count.sourcesRisque} {a._count.sourcesRisque === 1 ? t.analyses.sourcesSg : t.analyses.sources}</span>
                        <span><ClipboardList size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {a._count.scenariosStrategiques} {a._count.scenariosStrategiques === 1 ? t.analyses.scenarioSg : t.analyses.scenarios}</span>
                        <span><AlertTriangle size={15} className="inline align-[-0.15em] mr-1 text-amber-600" aria-hidden="true" /> {a._count.risques} {a._count.risques === 1 ? t.analyses.riskSg : t.analyses.risks}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                          <div className="bg-ebios-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">
                          {(() => { const AtIcon = ATELIER_ICONS[_ai]; return AtIcon ? <AtIcon size={13} className="inline align-[-0.15em] mr-1" aria-hidden="true" /> : null })()}{t.analyses.workshop} {a.atelierCourant}/5
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <Link href={`/analyses/${a.id}`} className="btn-secondary text-sm py-1.5">
                        {t.analyses.openBtn}
                      </Link>
                      {/* Export toujours disponible */}
                      <div className="relative group">
                        <button className="btn-secondary text-sm py-1.5 inline-flex items-center gap-1.5"><Download size={15} aria-hidden="true" /> {t.analyses.exportBtn}</button>
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-2 hidden group-hover:flex flex-col z-10 w-44">
                          <a href={`/api/export/${a.id}?format=pdf`} download className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"><FileText size={15} aria-hidden="true" /> PDF</a>
                          <a href={`/api/export/${a.id}?format=csv`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"><FileSpreadsheet size={15} aria-hidden="true" /> CSV</a>
                          <a href={`/api/export/${a.id}?format=json`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"><FileJson size={15} aria-hidden="true" /> JSON</a>
                        </div>
                      </div>
                      <button
                        onClick={() => setPendingDelete(a.id)}
                        disabled={deleting === a.id}
                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                        aria-label="Supprimer l'analyse"
                      >
                        {deleting === a.id ? '…' : <Trash2 size={16} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {pendingDelete && (
        <ConfirmDialog
          message={t.deleteDialog.analyse}
          onConfirm={() => confirmDeleteAnalyse(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
