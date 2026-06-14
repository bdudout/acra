'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { ATELIERS_META } from '@/lib/ebios-data'
import { getRiskTier } from '@/lib/risk-scale'
import { useTranslation } from '@/lib/i18n/context'
import { formatDate } from '@/lib/format'
import { Download, FileText, FileSpreadsheet, FileJson, Trash2 } from 'lucide-react'
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

function AnalysesContent() {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [analyses, setAnalyses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterValue>(() => urlParamToFilter(searchParams.get('filter')))
  const [deleting, setDeleting] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  // Sync filtre avec l'URL
  useEffect(() => {
    setFilter(urlParamToFilter(searchParams.get('filter')))
  }, [searchParams])

  useEffect(() => {
    fetch('/api/analyses').then(r => r.json()).then(d => {
      setAnalyses(d.analyses || [])
      setLoading(false)
    })
  }, [])

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

  const filtered = sorted
    .filter(a => filter === 'ALL' || a.statut === filter)
    .filter(a =>
      !search ||
      a.nom.toLowerCase().includes(search.toLowerCase()) ||
      (a.organisation || '').toLowerCase().includes(search.toLowerCase())
    )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
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
              {importing ? '⏳ Import…' : '📂 Importer'}
            </button>
            <ExpressAnalyseButton variant="button" />
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
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">{t.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-gray-500">{t.analyses.notFound}</p>
            <Link href="/analyses/new" className="btn-primary inline-block mt-4">{t.analyses.createBtn}</Link>
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
                ? { label: `🔴 ${critiques} ${critiques === 1 ? t.analyses.riskSg : t.analyses.risks}`, cls: 'bg-red-100 text-red-700',    href: '/risques?niveau=critique' }
                : maxTier === 'eleve'
                  ? { label: `🟠 élevé (${maxRisk})`,    cls: 'bg-orange-100 text-orange-700', href: '/risques?niveau=eleve' }
                  : maxTier === 'modere'
                    ? { label: `🟡 modéré (${maxRisk})`, cls: 'bg-yellow-100 text-yellow-700', href: '/risques?niveau=modere' }
                    : null

              // Mesures P1 à faire
              const mesuresP1AFaire = (a.mesures ?? []).filter((m: any) => m.priorite === 1 && m.statut === 'A_FAIRE').length
              // Risques avec stratégie "à réduire" non encore traités
              const risquesReduire = (a.risques ?? []).filter((r: any) => r.strategie === 'REDUIRE').length

              const statutBadge = {
                TERMINE:  { label: `✅ ${t.analyses.doneStatus}`,           cls: 'bg-green-100 text-green-700'   },
                APPROUVE: { label: `🏆 ${t.statut.APPROUVE}`,               cls: 'bg-teal-100 text-teal-700'    },
                SOUMIS:   { label: `📤 ${t.statut.SOUMIS}`,                 cls: 'bg-blue-100 text-blue-700'    },
                EN_COURS: { label: `⚙️ ${t.analyses.inProgStatus}`,         cls: 'bg-orange-100 text-orange-700' },
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
                            🔽 {risquesReduire} {risquesReduire === 1 ? t.analyses.riskSg : t.analyses.risks} à réduire
                          </Link>
                        )}
                        {mesuresP1AFaire > 0 && (
                          <Link
                            href="/actions?priorite=1"
                            className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 hover:opacity-80 transition-opacity"
                            onClick={e => e.stopPropagation()}
                          >
                            🛡️ {mesuresP1AFaire} P1 à faire
                          </Link>
                        )}
                        {(a as any).isSocle && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                            🏛️ Socle
                          </span>
                        )}
                        {(a as any).socle && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-600">
                            🔗 {(a as any).socle.nom}
                          </span>
                        )}
                      </div>
                      {(a.organisation || a.secteur) && (
                        <div className="text-sm text-gray-500 mb-2">
                          {[a.organisation, a.secteur].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3 flex-wrap">
                        <span><span aria-hidden="true">📅 </span>{t.analyses.created} {formatDate(a.createdAt, locale)}</span>
                        <span><span aria-hidden="true">✏️ </span>{t.analyses.modified} {formatDate(a.updatedAt, locale)}</span>
                        <span>🎭 {a._count.sourcesRisque} {a._count.sourcesRisque === 1 ? t.analyses.sourcesSg : t.analyses.sources}</span>
                        <span>📋 {a._count.scenariosStrategiques} {a._count.scenariosStrategiques === 1 ? t.analyses.scenarioSg : t.analyses.scenarios}</span>
                        <span>⚠️ {a._count.risques} {a._count.risques === 1 ? t.analyses.riskSg : t.analyses.risks}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                          <div className="bg-ebios-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">
                          {atelier.icon} {t.analyses.workshop} {a.atelierCourant}/5
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

    </div>
  )
}

export default function AnalysesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Chargement…</div>}>
      <AnalysesContent />
    </Suspense>
  )
}
