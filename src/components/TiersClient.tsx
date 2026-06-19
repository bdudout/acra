'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import type { EcosystemZone } from '@/lib/ecosystem-radar'

export interface TiersRow {
  id:          string
  analyseId:   string
  analyseNom:  string
  analyseOrg:  string | null
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

export default function TiersClient({ tiers }: { tiers: TiersRow[] }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [zone, setZone] = useState<EcosystemZone | 'all'>('all')
  const [onlyCritique, setOnlyCritique] = useState(false)
  const critiqueCount = useMemo(() => tiers.filter(x => x.critique).length, [tiers])

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
        || (x.description ?? '').toLowerCase().includes(q)
        || x.analyseNom.toLowerCase().includes(q)
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

      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">{search || zone !== 'all' || onlyCritique ? '🔍' : '🤝'}</div>
          <p className="text-gray-500">{search || zone !== 'all' || onlyCritique ? t.tiers.noMatch : t.tiers.noTiers}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-2">{filtered.length} / {tiers.length} {t.tiers.countLabel}</p>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.tiers.colTiers}</th>
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">{t.tiers.colType}</th>
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.tiers.colAnalyse}</th>
                  <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">{radar.menaceLabel}</th>
                  <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.tiers.colZone}</th>
                  <th scope="col" className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...filtered].sort((a, b) => b.menace - a.menace).map(x => (
                  <tr key={x.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-medium text-gray-800">
                        {x.critique && <span className="text-amber-500 mr-1" title={t.workshop.a3.ppCritiqueLabel}>★</span>}
                        {x.nom}
                      </div>
                      {x.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{x.description}</div>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-gray-600">{ppTypes[x.type] ?? x.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 text-xs">{x.analyseNom}</div>
                      {x.analyseOrg && <div className="text-gray-500 text-xs">{x.analyseOrg}</div>}
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
                    <td className="px-4 py-3 text-right">
                      <Link href={`/analyses/${x.analyseId}/atelier/3`} className="text-xs text-ebios-600 hover:text-ebios-800 font-medium hover:underline whitespace-nowrap">
                        {t.tiers.goToAtelier}
                      </Link>
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
