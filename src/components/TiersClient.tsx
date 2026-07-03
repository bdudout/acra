'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type { EcosystemZone } from '@/lib/ecosystem-radar'
import { suggestTierDuplicates, tierGroupSignature, type ConsolidatedTier } from '@/lib/tiers'

// Clé de persistance (par navigateur) des groupes de doublons « ignorés ».
const IGNORED_DUPS_LS_KEY = 'acra:tiers:ignoredDups'
import ConfirmDialog from '@/components/ConfirmDialog'

export interface TiersRow {
  id:          string
  analyseId:   string
  analyseNom:  string
  analyseOrg:  string | null
  entite?:     string | null  // organisation (multi-org), en vue consolidée uniquement
  nom:         string
  type:        string
  description: string | null
  exposition:  number
  fiabilite:   number
  dependance?:  number
  penetration?: number
  maturite?:    number
  confiance?:   number
  menace:      number
  zone:        EcosystemZone
  critique?:   boolean
}

// Couleurs de zone (alignées sur le radar d'écosystème — 3 zones : danger=orange, contrôle=jaune, veille=vert)
const ZONE_STYLE: Record<EcosystemZone, { badge: string; dot: string }> = {
  danger:   { badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  controle: { badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  veille:   { badge: 'bg-green-100 text-green-700 border-green-200',     dot: 'bg-green-500' },
}

export default function TiersClient({ tiers, canMerge = false }: { tiers: ConsolidatedTier[]; canMerge?: boolean }) {
  const { t } = useTranslation()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [zone, setZone] = useState<EcosystemZone | 'all'>('all')
  const [onlyCritique, setOnlyCritique] = useState(false)
  const critiqueCount = useMemo(() => tiers.filter(x => x.critique).length, [tiers])
  // Doublons potentiels (lecture seule) : tiers au nom proche à harmoniser.
  const dupGroups = useMemo(() => suggestTierDuplicates(tiers), [tiers])

  // Groupes « ignorés » par l'utilisateur (persistés en localStorage, par signature
  // stable). Un groupe ignoré ne réapparaît que si sa composition change.
  const [ignoredSigs, setIgnoredSigs] = useState<string[]>([])
  const [showIgnored, setShowIgnored] = useState(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(IGNORED_DUPS_LS_KEY)
      if (raw) setIgnoredSigs(JSON.parse(raw))
    } catch { /* localStorage indisponible → pas de persistance */ }
  }, [])
  function persistIgnored(next: string[]) {
    setIgnoredSigs(next)
    try { localStorage.setItem(IGNORED_DUPS_LS_KEY, JSON.stringify(next)) } catch { /* noop */ }
  }
  const ignoredSet = useMemo(() => new Set(ignoredSigs), [ignoredSigs])
  const visibleDups = useMemo(() => dupGroups.filter(g => !ignoredSet.has(tierGroupSignature(g))), [dupGroups, ignoredSet])
  const ignoredDups = useMemo(() => dupGroups.filter(g => ignoredSet.has(tierGroupSignature(g))), [dupGroups, ignoredSet])

  // Fusion (étape 2b) : nom cible choisi par groupe (clé = signature) + confirmation.
  const defaultTarget = (g: ConsolidatedTier[]) => g.map(x => x.nom).reduce((a, b) => (b.length < a.length ? b : a))
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({})
  const [confirmSig, setConfirmSig] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mergeMsg, setMergeMsg] = useState<string | null>(null)

  async function runMerge(sig: string) {
    const g = dupGroups.find(x => tierGroupSignature(x) === sig)
    if (!g) return
    const cible = mergeTarget[sig] ?? defaultTarget(g)
    setBusy(true)
    setMergeMsg(null)
    try {
      const res = await fetch('/api/tiers/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noms: g.map(x => x.nom), cible }),
      })
      if (res.ok) {
        const d = await res.json() as { renamed: number; blocked: number }
        setMergeMsg(t.tiers.mergeDone.replace('{n}', String(d.renamed)).replace('{b}', String(d.blocked)))
        router.refresh()
      } else {
        setMergeMsg(t.tiers.mergeError)
      }
    } catch {
      setMergeMsg(t.tiers.mergeError)
    } finally {
      setBusy(false)
      setConfirmSig(null)
    }
  }

  const ppTypes = t.workshop.a3.ppTypes as Record<string, string>
  const radar = t.workshop.a3.radar
  const zoneLabel: Record<EcosystemZone, string> = {
    danger: radar.zoneDanger, controle: radar.zoneControle, veille: radar.zoneVeille,
  }

  const counts = useMemo(() => ({
    all:      tiers.length,
    danger:   tiers.filter(x => x.zone === 'danger').length,
    controle: tiers.filter(x => x.zone === 'controle').length,
    veille:   tiers.filter(x => x.zone === 'veille').length,
  }), [tiers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return tiers.filter(x => {
      if (onlyCritique && !x.critique) return false
      if (zone !== 'all' && x.zone !== zone) return false
      if (!q) return true
      return x.nom.toLowerCase().includes(q)
        || x.analyses.some(a => a.analyseNom.toLowerCase().includes(q))
        || (ppTypes[x.type] ?? x.type).toLowerCase().includes(q)
    })
  }, [tiers, search, zone, onlyCritique, ppTypes])

  const filters: { key: EcosystemZone | 'all'; label: string; count: number; active: string }[] = [
    { key: 'all',      label: t.tiers.filterAll, count: counts.all,      active: 'bg-gray-100 text-gray-800' },
    { key: 'danger',   label: radar.zoneDanger,  count: counts.danger,   active: 'bg-orange-100 text-orange-800' },
    { key: 'controle', label: radar.zoneControle, count: counts.controle, active: 'bg-yellow-100 text-yellow-800' },
    { key: 'veille',   label: radar.zoneVeille,  count: counts.veille,   active: 'bg-green-100 text-green-800' },
  ]

  return (
    <div>
      {/* Filtres par zone */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs text-gray-500 self-center font-medium uppercase tracking-wide w-full sm:w-auto">{t.tiers.zoneLabel}</span>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setZone(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${zone === f.key ? f.active : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}
          >
            {f.label} <span className="opacity-70">({f.count})</span>
          </button>
        ))}
        {/* Filtre indépendant : uniquement les tiers critiques */}
        <button
          onClick={() => setOnlyCritique(v => !v)}
          aria-pressed={onlyCritique}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${onlyCritique ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
        >
          <span className="text-amber-500">★</span> {t.tiers.filterCritique} <span className="opacity-70">({critiqueCount})</span>
        </button>
      </div>

      {/* Recherche */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t.tiers.searchPh}
        className="input w-full mb-4 text-sm"
      />

      {/* Doublons potentiels : suggestion + fusion optionnelle (étape 2b) + ignorer */}
      {visibleDups.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">⚠️ {t.tiers.dupHintTitle} ({visibleDups.length})</p>
          <p className="text-xs text-amber-800 mt-0.5">{t.tiers.dupHintText}</p>
          {mergeMsg && <p className="text-xs font-medium text-amber-900 mt-2" role="status">{mergeMsg}</p>}
          <ul className="mt-2 space-y-2">
            {visibleDups.map(g => {
              const sig = tierGroupSignature(g)
              return (
              <li key={sig} className="text-xs text-amber-900">
                <span>• {g.map(x => x.nom).join('  ·  ')}</span>
                <span className="inline-flex items-center gap-1.5 ml-2 align-middle">
                  {canMerge && (
                    <>
                      <label className="sr-only" htmlFor={`merge-target-${sig}`}>{t.tiers.mergeTo}</label>
                      <select
                        id={`merge-target-${sig}`}
                        value={mergeTarget[sig] ?? defaultTarget(g)}
                        onChange={e => setMergeTarget(m => ({ ...m, [sig]: e.target.value }))}
                        disabled={busy}
                        className="rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[11px] text-amber-900"
                      >
                        {g.map(x => <option key={x.key} value={x.nom}>{x.nom}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => setConfirmSig(sig)}
                        disabled={busy}
                        className="rounded bg-amber-500 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        {t.tiers.mergeBtn}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => persistIgnored([...ignoredSigs, sig])}
                    className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
                  >
                    {t.tiers.dupIgnore}
                  </button>
                </span>
              </li>
              )
            })}
          </ul>
          {ignoredDups.length > 0 && (
            <div className="mt-2 border-t border-amber-200 pt-2">
              <button
                type="button"
                onClick={() => setShowIgnored(v => !v)}
                className="text-[11px] text-amber-700 underline hover:text-amber-900"
              >
                {ignoredDups.length} {t.tiers.dupIgnoredCount} — {showIgnored ? t.tiers.dupHideIgnored : t.tiers.dupShowIgnored}
              </button>
              {showIgnored && (
                <ul className="mt-1.5 space-y-1">
                  {ignoredDups.map(g => {
                    const sig = tierGroupSignature(g)
                    return (
                      <li key={sig} className="text-[11px] text-amber-700 flex items-center gap-2">
                        <span className="line-through opacity-70">{g.map(x => x.nom).join('  ·  ')}</span>
                        <button
                          type="button"
                          onClick={() => persistIgnored(ignoredSigs.filter(s => s !== sig))}
                          className="underline hover:text-amber-900"
                        >
                          {t.tiers.dupRestore}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Aucun doublon visible mais des groupes ignorés : accès à la restauration */}
      {visibleDups.length === 0 && ignoredDups.length > 0 && (
        <div className="mb-4 text-xs text-gray-400">
          <button type="button" onClick={() => setShowIgnored(v => !v)} className="underline hover:text-gray-600">
            {ignoredDups.length} {t.tiers.dupIgnoredCount} — {showIgnored ? t.tiers.dupHideIgnored : t.tiers.dupShowIgnored}
          </button>
          {showIgnored && (
            <ul className="mt-1.5 space-y-1">
              {ignoredDups.map(g => {
                const sig = tierGroupSignature(g)
                return (
                  <li key={sig} className="flex items-center gap-2">
                    <span className="line-through">{g.map(x => x.nom).join('  ·  ')}</span>
                    <button type="button" onClick={() => persistIgnored(ignoredSigs.filter(s => s !== sig))} className="underline hover:text-gray-600">
                      {t.tiers.dupRestore}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {confirmSig !== null && dupGroups.find(x => tierGroupSignature(x) === confirmSig) && (
        <ConfirmDialog
          variant="warning"
          icon="🔀"
          title={t.tiers.mergeConfirmTitle}
          message={t.tiers.mergeConfirmMsg.replace('{cible}', mergeTarget[confirmSig] ?? defaultTarget(dupGroups.find(x => tierGroupSignature(x) === confirmSig)!))}
          confirmLabel={t.tiers.mergeBtn}
          onConfirm={() => runMerge(confirmSig)}
          onCancel={() => setConfirmSig(null)}
        />
      )}

      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">{search || zone !== 'all' || onlyCritique ? '🔍' : '🤝'}</div>
          <p className="text-gray-500">{search || zone !== 'all' || onlyCritique ? t.tiers.noMatch : t.tiers.noTiers}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-1">{filtered.length} / {tiers.length} {t.tiers.countLabel}</p>
          <p className="text-xs text-gray-400 italic mb-3">{t.workshop.a3.radar.multiLegend}</p>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.tiers.colTiers}</th>
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">{t.tiers.colType}</th>
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.tiers.colAnalyse}</th>
                  <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">{radar.menaceLabel}</th>
                  <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.tiers.colZone}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(x => (
                  <tr key={x.key} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-medium text-gray-800">
                        {x.critique && <span className="text-amber-500 mr-1" title={t.workshop.a3.ppCritiqueLabel}>★</span>}
                        {x.nom}
                      </div>
                      {x.occurrences > 1 && (
                        <div className="text-[10px] text-gray-400 mt-0.5">{x.occurrences} {t.tiers.occurrences}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-gray-600">{ppTypes[x.type] ?? x.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {x.analyses.map(a => (
                          <Link key={a.analyseId} href={`/analyses/${a.analyseId}/atelier/3`}
                            className="text-xs text-ebios-600 hover:text-ebios-800 hover:underline">
                            {a.analyseNom}
                            {a.entite && (
                              <span className="ml-1 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-600">
                                <Building2 size={10} aria-hidden="true" /> {a.entite}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className="text-sm font-bold text-gray-800">{x.menace.toFixed(2)}</span>
                      <div className="text-[10px] text-gray-400">{t.workshop.a3.ppExpLabel} {x.exposition} · {t.workshop.a3.ppFiabLabel} {x.fiabilite}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ZONE_STYLE[x.zone].badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ZONE_STYLE[x.zone].dot}`} />
                        {zoneLabel[x.zone]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
