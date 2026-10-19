'use client'

// ─── Critère d'acceptation appliqué (n° 51) ──────────────────────────────────
// Établissement du contexte (ISO 27005 / NIST / ISO 31000) : affiche, en lecture seule,
// le critère que la phase d'évaluation applique réellement (`critereAcceptation`, même
// règle qu'`evaluateRisk`) — appétit de l'organisation, sinon paliers de l'échelle — et
// qui peut le changer. Remplace le champ libre « critères », qui n'était pas appliqué.
import Link from 'next/link'
import { Scale } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { resolveScaleConfig, type ScaleConfig } from '@/lib/risk-scale'
import { APPETIT_DEFAULT, type AppetitConfig } from '@/lib/appetit'
import { critereAcceptation, paliersATraiter } from '@/lib/risque-priorisation'

export default function CritereAcceptationApplique({ scale, appetit, peutModifier }: {
  scale?: Partial<ScaleConfig> | null
  appetit?: AppetitConfig | null
  /** Rôle de gouvernance (administrateur, gestionnaire des risques, RSSI) : lien vers le réglage. */
  peutModifier: boolean
}) {
  const { t } = useTranslation()
  const m = t.risquesDirects
  const echelle = resolveScaleConfig(scale)
  const c = critereAcceptation({ scale: echelle, appetit: appetit ?? APPETIT_DEFAULT })
  const paliers = (c.basis === 'ECHELLE' ? c.aTraiter : paliersATraiter(echelle)).join(', ')

  const lignes: string[] = []
  if (c.basis === 'APPETIT') {
    if (c.seuil != null) lignes.push(m.critereAppetit.replace('{seuil}', String(c.seuil)))
    else lignes.push(m.critereAppetitParCategorie.replace('{paliers}', paliers))
    if (c.seuil != null && c.nbCategories > 0) lignes.push(m.critereAppetitCategories.replace('{n}', String(c.nbCategories)))
  } else {
    lignes.push(m.critereEchelle.replace('{paliers}', paliers))
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
        <Scale size={16} aria-hidden="true" />{m.critereTitre}
      </h3>
      {lignes.map((l, i) => <p key={i} className="mt-1 text-sm text-gray-700 dark:text-gray-200">{l}</p>)}
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {m.critereQui}
        {peutModifier && <> <Link href="/cartographie" className="text-ebios-700 dark:text-ebios-300 underline">{m.critereLien}</Link></>}
      </p>
    </div>
  )
}
