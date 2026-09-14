'use client'

// Éditeur du SOCLE DE CONFORMITÉ au niveau organisation. Permet à un ADMIN / RSSI /
// Risk Manager de renseigner directement la conformité de référence de l'org
// (par référentiel), sans passer par une analyse — ce qui débloque le dashboard
// /conformite (auparavant en impasse quand aucun suivi n'existait). Réutilise la
// grille ConformiteGrid + l'API /api/organizations/[orgId]/conformite.

import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Save, CheckCircle2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import ConformiteGrid from '@/components/ConformiteGrid'
import type { FrameworkControl } from '@/lib/frameworks-data'
import { conformiteStats, type ConformiteEntry, type ConformiteStatut } from '@/lib/conformite'

interface RefOpt { code: string; nom: string }

export default function OrgConformiteEditor({ orgId, orgNom, referentiels, initialRef }: {
  orgId: string
  orgNom: string
  referentiels: RefOpt[]
  initialRef: string
}) {
  const { t, locale } = useTranslation()
  const c = t.conformiteSocle
  const [ref, setRef] = useState(initialRef)
  const [entries, setEntries] = useState<ConformiteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [snapshotting, setSnapshotting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  // Reprendre la conformité d'une analyse.
  const [analysesDispo, setAnalysesDispo] = useState<{ id: string; nom: string; count: number }[]>([])
  const [importFrom, setImportFrom] = useState('')
  const [importing, setImporting] = useState(false)

  // Contrôles du référentiel sélectionné — résolus côté serveur (builtin OU custom).
  const [controles, setControles] = useState<FrameworkControl[]>([])
  const stats = useMemo(() => conformiteStats(entries, controles.length), [entries, controles.length])

  useEffect(() => {
    let annule = false
    setLoading(true); setError(null)
    Promise.all([
      fetch(`/api/organizations/${orgId}/conformite?referentiel=${encodeURIComponent(ref)}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/referentiels/exigences?code=${encodeURIComponent(ref)}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/organizations/${orgId}/conformite/import?referentiel=${encodeURIComponent(ref)}`).then(r => r.ok ? r.json() : null),
    ])
      .then(([conf, exi, imp]) => {
        if (annule) return
        setEntries(Array.isArray(conf?.entries) ? conf.entries : [])
        setControles(Array.isArray(exi?.exigences) ? exi.exigences.map((e: { ref: string; nom: string; categorie?: string }) => ({ ref: e.ref, nom: e.nom, categorie: e.categorie })) : [])
        setAnalysesDispo(Array.isArray(imp?.analyses) ? imp.analyses : [])
        setImportFrom('')
      })
      .catch(() => { if (!annule) setError(c.loadError) })
      .finally(() => { if (!annule) setLoading(false) })
    return () => { annule = true }
  }, [orgId, ref, reloadKey, c.loadError])

  async function reprendreAnalyse() {
    if (!importFrom) return
    setImporting(true); setError(null)
    const res = await fetch(`/api/organizations/${orgId}/conformite/import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referentiel: ref, analyseId: importFrom }),
    })
    setImporting(false)
    if (!res.ok) { setError(c.saveError); return }
    setSavedAt(Date.now()); setReloadKey(k => k + 1)
  }

  // Persiste le changement d'UN contrôle (l'API applique par contrôle + snapshot éventuel).
  async function persist(controleRef: string, statut: ConformiteStatut) {
    const res = await fetch(`/api/organizations/${orgId}/conformite`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referentiel: ref, ref: controleRef, statut }),
    })
    if (!res.ok) { setError(c.saveError); return }
    setSavedAt(Date.now())
  }

  function onChange(next: ConformiteEntry[]) {
    const avant = new Map(entries.map(e => [e.ref, e.statut]))
    setEntries(next)
    setError(null)
    for (const e of next) {
      if (avant.get(e.ref) !== e.statut) persist(e.ref, e.statut)
    }
  }

  async function figerVersion() {
    setSnapshotting(true); setError(null)
    const res = await fetch(`/api/organizations/${orgId}/conformite`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referentiel: ref, label: new Date().toLocaleDateString(locale) }),
    })
    setSnapshotting(false)
    if (res.ok) setSavedAt(Date.now()); else setError(c.saveError)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ShieldCheck size={22} aria-hidden="true" /> {c.title}</h1>
          <p className="text-gray-500 text-sm mt-0.5 max-w-2xl">{c.subtitle.replace('{org}', orgNom)}</p>
        </div>
        <div className="flex items-end gap-3">
          <label className="text-xs text-gray-500">
            <span className="block font-medium mb-1">{c.referentiel}</span>
            <select value={ref} onChange={e => setRef(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white text-gray-800 min-w-[12rem]">
              {referentiels.map(r => <option key={r.code} value={r.code}>{r.nom}</option>)}
            </select>
          </label>
          <button onClick={figerVersion} disabled={snapshotting || stats.evalues === 0}
            className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50 inline-flex items-center gap-1.5" title={c.snapshotHint}>
            <Save size={14} aria-hidden="true" /> {snapshotting ? c.snapshotting : c.snapshot}
          </button>
        </div>
      </div>

      {/* Bandeau d'avancement */}
      <div className="flex flex-wrap items-center gap-4 text-sm rounded-lg border border-gray-200 bg-white px-4 py-2.5">
        <span className="font-semibold text-gray-900">{stats.tauxConformite}%</span>
        <span className="text-gray-500">{c.evalues.replace('{n}', String(stats.evalues)).replace('{total}', String(controles.length))}</span>
        {savedAt && <span className="text-green-600 inline-flex items-center gap-1 ml-auto"><CheckCircle2 size={14} aria-hidden="true" /> {c.saved}</span>}
      </div>

      {/* Reprendre la conformité d'une analyse existante (même référentiel) */}
      {analysesDispo.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm rounded-lg border border-ebios-200 bg-ebios-50/50 px-4 py-2.5">
          <span className="text-ebios-800">{c.importLabel}</span>
          <select value={importFrom} onChange={e => setImportFrom(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white text-gray-800 min-w-[12rem]">
            <option value="">{c.importSelect}</option>
            {analysesDispo.map(a => <option key={a.id} value={a.id}>{a.nom} ({a.count})</option>)}
          </select>
          <button onClick={reprendreAnalyse} disabled={!importFrom || importing} className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-50">
            {importing ? c.importing : c.importBtn}
          </button>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}

      {loading
        ? <p className="text-gray-400 text-sm py-8 text-center">{t.loading}</p>
        : <ConformiteGrid controles={controles} entries={entries} onChange={onChange} showVulnCatalog={false} />}
    </div>
  )
}
