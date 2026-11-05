'use client'

// ─── Stratégie : historique après validation (lot S1b) ───────────────────────
// Évolutions tracées après validation (type, avant / après lisible, justification, auteur, date) et écart entre le
// cadre validé et le cadre courant (`ecartCadre`, calculé par l'API). API : /api/strategies/[id]/historique.
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { resumeValeurs, type ContexteResume } from '@/lib/strategie-ui'
import type { EcartCadre } from '@/lib/strategie'

interface Evolution { id: string; type: string; avant: unknown; apres: unknown; justification: string; auteurNom: string | null; createdAt: string }
interface Historique {
  statut: string; valideeLe: string | null; evolutions: Evolution[]
  ecart: Pick<EcartCadre, 'identique'> & { axes: Record<'ajoutes' | 'modifies' | 'supprimes', { id: string; titre?: string; apres?: { titre: string } }[]>; objectifs: Record<'ajoutes' | 'modifies' | 'supprimes', { id: string; titre?: string; apres?: { titre: string } }[]> }
  rattachementsDepuisValidation: unknown[]
}

export default function StrategieHistorique({ id, axes, elements }: { id: string; axes: Map<string, string>; elements: Map<string, string> }) {
  const { t, locale } = useTranslation()
  const s = t.strategie
  const h = s.ui.historique
  const [data, setData] = useState<Historique | null>(null)

  useEffect(() => {
    fetch(`/api/strategies/${id}/historique`).then(r => (r.ok ? r.json() : null)).then(setData).catch(() => {})
  }, [id])

  if (!data) return <p className="text-sm text-gray-400">{s.ui.chargement}</p>
  if (!data.valideeLe) return <p className="text-sm text-gray-500">{h.nonValidee}</p>

  const ctx: ContexteResume = { champs: s.ui.champs, sources: s.ui.sources, provenances: s.provenances, axes, elements, locale, gabarit: s.ui.gabaritChamp }
  const groupes = [
    [h.axesAjoutes, data.ecart.axes.ajoutes], [h.axesModifies, data.ecart.axes.modifies], [h.axesSupprimes, data.ecart.axes.supprimes],
    [h.objectifsAjoutes, data.ecart.objectifs.ajoutes], [h.objectifsModifies, data.ecart.objectifs.modifies], [h.objectifsSupprimes, data.ecart.objectifs.supprimes],
  ] as const

  return (
    <div className="space-y-6">
      <section className="card p-4" aria-labelledby="historique-evolutions">
        <h2 id="historique-evolutions" className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">{h.titre}</h2>
        {data.evolutions.length === 0 ? <p className="text-sm text-gray-500">{h.vide}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <tr>{[h.colDate, h.colType, h.colAvant, h.colApres, h.colJustification, h.colAuteur].map(c => <th key={c} scope="col" className="px-2 py-1.5">{c}</th>)}</tr>
              </thead>
              <tbody>
                {data.evolutions.map(e => (
                  <tr key={e.id} className="border-t border-gray-100 dark:border-gray-700 align-top">
                    <td className="px-2 py-1.5 whitespace-nowrap">{new Date(e.createdAt).toLocaleString(locale)}</td>
                    <td className="px-2 py-1.5">{(s.evolutions as Record<string, string>)[e.type] ?? e.type}</td>
                    <td className="px-2 py-1.5">{resumeValeurs(e.avant, ctx)}</td>
                    <td className="px-2 py-1.5">{resumeValeurs(e.apres, ctx)}</td>
                    <td className="px-2 py-1.5">{e.justification || '—'}</td>
                    <td className="px-2 py-1.5">{e.auteurNom ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-4 space-y-2" aria-labelledby="historique-ecart">
        <h2 id="historique-ecart" className="text-sm font-semibold text-gray-800 dark:text-gray-100">{h.ecart}</h2>
        {data.ecart.identique ? <p className="text-sm text-gray-500">{h.identique}</p> : groupes.filter(([, l]) => l.length > 0).map(([titre, l]) => (
          <div key={titre}>
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300">{titre}</h3>
            <ul className="list-disc ml-5 text-sm">{l.map(x => <li key={x.id}>{x.apres?.titre ?? x.titre ?? x.id}</li>)}</ul>
          </div>
        ))}
        <p className="text-sm text-gray-600 dark:text-gray-300">{h.rattachesDepuis.replace('{n}', String(data.rattachementsDepuisValidation.length))}</p>
      </section>
    </div>
  )
}
