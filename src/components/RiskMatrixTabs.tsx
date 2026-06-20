'use client'

/**
 * RiskMatrixTabs — 3 onglets pour visualiser la matrice des risques selon l'angle :
 *  - Bruts     : risque initial (gravité × vraisemblance), avant traitement
 *  - À date    : position actuelle interpolée selon les mesures déjà réalisées
 *  - Résiduels : position cible, une fois tous les plans d'action mis en œuvre
 *
 * La position « à date » provient de src/lib/risk-current.ts (testé).
 */
import { useState } from 'react'
import RiskMatrix from '@/components/RiskMatrix'
import { useTranslation } from '@/lib/i18n/context'
import { risqueADate, type RiskLike, type MeasureLike } from '@/lib/risk-current'
import type { ScaleConfig } from '@/lib/risk-scale'

interface RiskRow extends RiskLike {
  nom: string
}

type TabKey = 'gross' | 'current' | 'residual'

export default function RiskMatrixTabs({
  risks,
  mesures,
  config,
}: {
  risks: RiskRow[]
  mesures: MeasureLike[]
  config?: Partial<ScaleConfig> | null
}) {
  const { t } = useTranslation()
  const tabs = t.analysis.riskTabs
  const [tab, setTab] = useState<TabKey>('gross')

  const gross = risks.map(r => ({ nom: r.nom, gravite: r.gravite, vraisemblance: r.vraisemblance }))
  const current = risks.map(r => {
    const c = risqueADate(r, mesures)
    return { nom: r.nom, gravite: c.gravite, vraisemblance: c.vraisemblance }
  })
  const residual = risks
    .filter(r => r.graviteResiduelle != null && r.vraisemblanceResiduelle != null)
    .map(r => ({ nom: r.nom, gravite: r.graviteResiduelle as number, vraisemblance: r.vraisemblanceResiduelle as number }))

  const active = tab === 'gross' ? gross : tab === 'current' ? current : residual
  const TAB_DEFS: [TabKey, string][] = [['gross', tabs.gross], ['current', tabs.current], ['residual', tabs.residual]]

  return (
    <div className="card p-5">
      <h2 className="text-sm font-medium text-gray-500 mb-3 dark:text-gray-400">{t.analysis.riskMatrix}</h2>
      <div role="tablist" aria-label={t.analysis.riskMatrix} className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 dark:bg-gray-900">
        {TAB_DEFS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white shadow-sm text-ebios-700 dark:bg-gray-700 dark:text-ebios-300'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'current' && <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">{tabs.currentHint}</p>}
      {tab === 'residual' && <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">{tabs.residualHint}</p>}

      <RiskMatrix config={config} risks={active} />
    </div>
  )
}
