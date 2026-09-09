'use client'

import { Globe } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import EcosystemRadar from '@/components/EcosystemRadar'

export interface FullTier {
  id: string
  nom: string
  nomCourt?: string
  type: string
  exposition: number
  fiabilite: number
  dependance?: number
  penetration?: number
  maturite?: number
  confiance?: number
  critique?: boolean
  rang?: number
  cle?: string
  parentCle?: string
  orgId: string
  orgNom: string
}

interface OrgTab { id: string; nom: string; count: number }

// Catégories de tiers connues (ordre d'affichage). Les types inconnus sont ajoutés dynamiquement.
const KNOWN_TYPES = ['FOURNISSEUR', 'PRESTATAIRE', 'PARTENAIRE', 'CLIENT'] as const

/**
 * Vue plein écran de l'écosystème : TOUS les tiers, filtrables par entité/filiale
 * (onglets en haut) et par catégorie (chips en bas). Pensée pour des centaines de
 * tiers, là où le radar du tableau de bord se limite aux plus prioritaires.
 */
export default function EcosystemFullView({ tiers, orgs }: { tiers: FullTier[]; orgs: OrgTab[] }) {
  const { t } = useTranslation()
  const e = t.ecosysteme
  const ppTypes = t.workshop.a3.ppTypes as Record<string, string>

  const [org, setOrg] = useState<string>('all')
  const showTabs = orgs.length > 1

  // Tiers du périmètre entité sélectionné (avant filtre catégorie).
  const byOrg = useMemo(() => (org === 'all' ? tiers : tiers.filter(x => x.orgId === org)), [tiers, org])

  // Catégories présentes (connues d'abord, puis autres) + décompte dans le périmètre.
  const typeList = useMemo(() => {
    const present = new Set(byOrg.map(x => x.type))
    const ordered = [...KNOWN_TYPES.filter(ty => present.has(ty)), ...[...present].filter(ty => !KNOWN_TYPES.includes(ty as typeof KNOWN_TYPES[number])).sort()]
    return ordered.map(ty => ({ type: ty, count: byOrg.filter(x => x.type === ty).length }))
  }, [byOrg])

  // Catégories actives (toutes par défaut ; réinitialisées quand le périmètre change).
  const [active, setActive] = useState<Set<string> | null>(null)
  const activeSet = active ?? new Set(typeList.map(x => x.type))
  const toggle = (ty: string) => {
    const base = active ?? new Set(typeList.map(x => x.type))
    const next = new Set(base)
    if (next.has(ty)) next.delete(ty); else next.add(ty)
    setActive(next)
  }

  const shown = useMemo(() => byOrg.filter(x => activeSet.has(x.type)), [byOrg, activeSet])

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><Globe size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {e.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{e.subtitle.replace('{shown}', String(shown.length)).replace('{total}', String(tiers.length))}</p>
        </div>
      </div>

      {/* Onglets par entité / filiale (en haut) */}
      {showTabs && (
        <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
          <button onClick={() => setOrg('all')}
            className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 ${org === 'all' ? 'border-ebios-600 text-ebios-700 dark:text-ebios-300' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>
            {e.allEntities} <span className="text-xs text-gray-400">({tiers.length})</span>
          </button>
          {orgs.map(o => (
            <button key={o.id} onClick={() => setOrg(o.id)}
              className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 ${org === o.id ? 'border-ebios-600 text-ebios-700 dark:text-ebios-300' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>
              {o.nom} <span className="text-xs text-gray-400">({o.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Radar plein écran */}
      <div className="card p-4 mb-4">
        {shown.length === 0
          ? <p className="text-sm text-gray-400 italic py-10 text-center">{e.empty}</p>
          : <EcosystemRadar parties={shown} hideHeader aggregated manageTiersHref="/tiers" />}
      </div>

      {/* Filtres de catégories (en bas) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">{e.categories} :</span>
        {typeList.map(({ type, count }) => {
          const on = activeSet.has(type)
          return (
            <button key={type} onClick={() => toggle(type)}
              className={`text-sm px-3 py-1 rounded-full font-medium transition-colors border ${on ? 'bg-ebios-600 text-white border-ebios-600' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}>
              {ppTypes[type] ?? type} <span className={on ? 'text-ebios-100' : 'text-gray-400'}>({count})</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
