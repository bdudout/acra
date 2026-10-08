'use client'

// ─── Historique des réorganisations du référentiel des entités (lot E4) ───────
// 5 dernières années, de la plus récente à la plus ancienne. API : GET /api/referentiel-entites/reorganisations.
import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type { TypeReorganisation } from '@/lib/entites-reorganisation'

interface Evenement { id: string; type: TypeReorganisation; dateEffet: string; sources: { id: string; nom: string }[]; cibles: { id: string; nom: string }[]; nbObjets: number }

export default function HistoriqueEntites() {
  const { t, locale } = useTranslation()
  const r = t.entites.referentiel.reorganisation
  const [evenements, setEvenements] = useState<Evenement[] | null>(null)
  useEffect(() => {
    fetch('/api/referentiel-entites/reorganisations').then(x => (x.ok ? x.json() : { evenements: [] }))
      .then((j: { evenements?: Evenement[] }) => setEvenements(j.evenements ?? [])).catch(() => setEvenements([]))
  }, [])
  if (!evenements) return null
  return (
    <section aria-labelledby="historique-entites-titre" className="pt-2">
      <h3 id="historique-entites-titre" className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><History size={13} aria-hidden="true" />{r.historique}</h3>
      {evenements.length === 0 ? <p className="text-sm italic text-gray-400 mt-1">{r.aucunHistorique}</p> : (
        <ul className="mt-1 space-y-1">
          {evenements.map(e => (
            <li key={e.id} className="text-sm text-gray-700 dark:text-gray-200">
              {r.evenement.replace('{d}', new Date(e.dateEffet).toLocaleDateString(locale, { timeZone: 'UTC' })).replace('{t}', r.types[e.type] ?? e.type)
                .replace('{s}', e.sources.map(s => s.nom).join(', ')).replace('{c}', e.cibles.map(c => c.nom).join(', '))}
              {e.nbObjets > 0 && <span className="ml-2 text-xs text-gray-500">{r.objets.replace('{n}', String(e.nbObjets))}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
