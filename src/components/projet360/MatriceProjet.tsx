'use client'
// ─── Matrice des risques d'un projet 360 : brut / actuel / résiduel + filtre par catégorie ─
// Onglets d'étape et filtre par catégorie (domaine 360, avec le nombre de risques de chacune) au-dessus de la matrice
// (RiskMatrix, échelle de l'organisation). Cotations résolues côté serveur (lib/cotation-risque).

import { useMemo, useState } from 'react'
import RiskMatrix from '@/components/RiskMatrix'
import { useTranslation } from '@/lib/i18n/context'
import type { ScaleConfig } from '@/lib/risk-scale'

type GV = { g: number; v: number }
export interface RisqueMatrice { id: string; ref?: string; nom: string; domaine: string | null; brut: GV; actuel: GV; residuel: GV }
type Etape = 'brut' | 'actuel' | 'residuel'
const ETAPES: Etape[] = ['brut', 'actuel', 'residuel']
const SANS = '__sans__'

export default function MatriceProjet({ risques, scale }: { risques: RisqueMatrice[]; scale: Partial<ScaleConfig> | null }) {
  const { t } = useTranslation()
  const l = t.projet360.presentation
  const domaines = t.projet360.domaines as Record<string, string>
  const [etape, setEtape] = useState<Etape>('brut')
  const [categorie, setCategorie] = useState<string | null>(null)

  const categories = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of risques) m.set(r.domaine ?? SANS, (m.get(r.domaine ?? SANS) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [risques])
  const visibles = categorie == null ? risques : risques.filter(r => (r.domaine ?? SANS) === categorie)
  const points = visibles.map(r => ({ ref: r.ref, nom: r.nom, gravite: r[etape].g, vraisemblance: r[etape].v }))
  const chip = (actif: boolean) => `rounded-full border px-2.5 py-1 text-xs ${actif ? 'border-ebios-600 bg-ebios-50 font-medium text-ebios-800 dark:bg-ebios-900/30 dark:text-ebios-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'}`

  return (
    <section className="card p-5" aria-label={l.matrice}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{l.matrice}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{l.matriceHint}</p>
        </div>
        <div role="tablist" aria-label={l.etape} className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
          {ETAPES.map(e => (
            <button key={e} type="button" role="tab" aria-selected={etape === e} onClick={() => setEtape(e)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${etape === e ? 'bg-ebios-600 text-white' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}`}>
              {l[e]}
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label={l.filtreCategorie} className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-gray-500 dark:text-gray-400">{l.filtreCategorie}</span>
        <button type="button" aria-pressed={categorie == null} onClick={() => setCategorie(null)} className={chip(categorie == null)}>{l.toutes} ({risques.length})</button>
        {categories.map(([c, n]) => (
          <button key={c} type="button" aria-pressed={categorie === c} onClick={() => setCategorie(c)} className={chip(categorie === c)}>
            {c === SANS ? l.sansCategorie : domaines[c] ?? c} ({n})
          </button>
        ))}
      </div>
      <RiskMatrix risks={points} config={scale} />
    </section>
  )
}
