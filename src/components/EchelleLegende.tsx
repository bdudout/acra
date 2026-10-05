'use client'
// ─── Légende des échelles (G = gravité, V = vraisemblance), dépliable ─────────
// Libellés et descriptions des niveaux de l'échelle de l'organisation ; pour la gravité, impacts indicatifs
// (opérationnel, financier, juridique, image) — lib/echelle-legende.

import { HelpCircle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { impactsGravite, IMPACT_TYPES } from '@/lib/echelle-legende'
import type { ScaleConfig } from '@/lib/risk-scale'

export default function EchelleLegende({ scale }: { scale: ScaleConfig }) {
  const { t, locale } = useTranslation()
  const m = t.risquesDirects
  const impacts = impactsGravite(scale.nbNiveaux, locale)
  const types = m.impactTypes as Record<string, string>
  const th = 'px-2 py-1 text-left font-medium text-gray-500 dark:text-gray-400'
  const td = 'px-2 py-1 align-top text-gray-700 dark:text-gray-200'
  const pastille = (c: string) => <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: c }} />
  return (
    <details className="mb-3 rounded-lg border border-gray-200 bg-gray-50/60 text-xs dark:border-gray-700 dark:bg-gray-900/30">
      <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 font-medium text-gray-600 dark:text-gray-300">
        <HelpCircle size={14} aria-hidden="true" />{m.legendSummary}
      </summary>
      <div className="space-y-3 overflow-x-auto px-3 pb-3">
        <table className="w-full" aria-label={m.legendGravite}>
          <caption className="pb-1 text-left font-semibold text-gray-700 dark:text-gray-200">{m.legendGravite}</caption>
          <thead><tr><th className={th}>{m.legendNiveau}</th><th className={th}>{m.legendDescription}</th>{IMPACT_TYPES.map(k => <th key={k} className={th}>{types[k]}</th>)}</tr></thead>
          <tbody>
            {scale.echelleGravite.slice(0, scale.nbNiveaux).map((n, i) => (
              <tr key={n.niveau} className="border-t border-gray-100 dark:border-gray-800">
                <td className={`${td} whitespace-nowrap font-medium`}>{pastille(n.couleur)}{n.niveau} · {n.label}</td>
                <td className={td}>{n.description}</td>
                {IMPACT_TYPES.map(k => <td key={k} className={td}>{impacts[i]?.[k]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full" aria-label={m.legendVraisemblance}>
          <caption className="pb-1 text-left font-semibold text-gray-700 dark:text-gray-200">{m.legendVraisemblance}</caption>
          <tbody>
            {scale.echelleVraisemblance.slice(0, scale.nbNiveaux).map(n => (
              <tr key={n.niveau} className="border-t border-gray-100 dark:border-gray-800">
                <td className={`${td} whitespace-nowrap font-medium`}>{pastille(n.couleur)}{n.niveau} · {n.label}</td>
                <td className={td}>{n.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-gray-400">{m.legendIndicatif}</p>
      </div>
    </details>
  )
}
