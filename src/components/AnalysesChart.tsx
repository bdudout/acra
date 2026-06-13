'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { getRiskTier } from '@/lib/risk-scale'

interface Analyse {
  id: string
  nom: string
  statut: string
  atelierCourant: number
  updatedAt: Date | string
  isSocle?: boolean
  risques: { niveauRisque: number; niveauResiduel: number | null; strategie: string }[]
  mesures: { statut: string; priorite: number }[]
  _count: { sourcesRisque: number; scenariosStrategiques: number; risques: number; mesures: number }
}

interface Props {
  analyses: Analyse[]
}

const STRAT_COLORS: Record<string, string> = {
  REDUIRE: '#3b82f6',
  ACCEPTER: '#22c55e',
  TRANSFERER: '#f59e0b',
  REFUSER: '#ef4444',
  SURVEILLER: '#8b5cf6',
}

function getNiveauColor(n: number) {
  if (n >= 12) return '#ef4444'
  if (n >= 8)  return '#f97316'
  if (n >= 4)  return '#f59e0b'
  return '#22c55e'
}

export default function AnalysesChart({ analyses }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const c = t.dashboard.chart

  if (analyses.length === 0) return null

  // Limiter l'affichage à 8 analyses pour lisibilité
  const shown = analyses.slice(0, 8)
  const maxRisques = Math.max(...shown.map(a => a._count.risques), 1)
  const maxMesures = Math.max(...shown.map(a => a._count.mesures), 1)

  return (
    <div className="space-y-6">
      {/* Tableau comparatif */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.colAnalyse}</th>
              <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.colProgress}</th>
              <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.colSR}</th>
              <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.colScenarios}</th>
              <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.colRisks}</th>
              <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.colCritical}</th>
              <th className="text-left py-2 pl-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.colProfile}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {shown.map(a => {
              const pct = a.statut === 'TERMINE' ? 100 : Math.round(((a.atelierCourant - 1) / 5) * 100)
              const critiques = a.risques.filter(r => getRiskTier(r.niveauRisque) === 'critique').length
              const moyens = a.risques.filter(r => getRiskTier(r.niveauRisque) === 'eleve').length
              const moderes = a.risques.filter(r => getRiskTier(r.niveauRisque) === 'modere').length
              const faibles = a.risques.filter(r => getRiskTier(r.niveauRisque) === 'faible').length

              return (
                <tr
                  key={a.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/analyses/${a.id}`)}
                  title={`Ouvrir l'analyse : ${a.nom}`}
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1.5">
                      <div className="font-medium text-ebios-700 text-sm truncate max-w-[130px] hover:underline" title={a.nom}>
                        {a.nom}
                      </div>
                      {a.isSocle && (
                        <span className="text-xs flex-shrink-0" title="Analyse socle">🏛️</span>
                      )}
                    </div>
                    <div className={`text-xs mt-0.5 ${a.statut === 'TERMINE' ? 'text-green-600' : 'text-orange-500'}`}>
                      {a.statut === 'TERMINE' ? `✅ ${c.statusDone}` : `⚙️ ${c.statusAtelier} ${a.atelierCourant}/5`}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-100 rounded-full h-2 flex-shrink-0">
                        <div
                          className={`h-2 rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-ebios-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{pct}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="text-sm font-medium text-gray-700">{a._count.sourcesRisque}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="text-sm font-medium text-gray-700">{a._count.scenariosStrategiques}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    {/* Barre proportionnelle */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 bg-gray-100 rounded-full h-2 flex-shrink-0">
                        <div
                          className="h-2 rounded-full bg-ebios-500"
                          style={{ width: `${(a._count.risques / maxRisques) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{a._count.risques}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    {critiques > 0 ? (
                      <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        {critiques}
                      </span>
                    ) : (
                      <span className="text-xs text-green-600">—</span>
                    )}
                  </td>
                  <td className="py-3 pl-4">
                    {a.risques.length > 0 ? (
                      <div className="flex gap-0.5 items-center">
                        {/* Stacked mini-bar */}
                        {[
                          { count: critiques, color: '#ef4444', label: c.labelCritique },
                          { count: moyens,    color: '#f97316', label: c.labelEleve },
                          { count: moderes,   color: '#f59e0b', label: c.labelModere },
                          { count: faibles,   color: '#22c55e', label: c.labelFaible },
                        ].filter(s => s.count > 0).map((s, i) => (
                          <div
                            key={i}
                            title={`${s.count} ${s.label}`}
                            className="h-4 rounded-sm flex-shrink-0"
                            style={{
                              width: `${(s.count / a.risques.length) * 64}px`,
                              backgroundColor: s.color,
                              minWidth: s.count > 0 ? '6px' : 0,
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 italic">{c.noRisk}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-100 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-400" />
          <span>{c.legendCritical}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-orange-400" />
          <span>{c.legendHigh}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-yellow-400" />
          <span>{c.legendMedium}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-400" />
          <span>{c.legendLow}</span>
        </div>
        <div className="ml-auto text-gray-500">{c.srLegend}</div>
      </div>
    </div>
  )
}
