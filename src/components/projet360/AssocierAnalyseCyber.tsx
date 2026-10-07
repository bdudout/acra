'use client'
// ─── « Associer une analyse cyber » à un projet 360 (menu) ────────────────────
// Créer une nouvelle analyse liée (/analyses/new?projet=…) ou lier une analyse cyber existante, trouvée par recherche
// (liste légère de /api/analyses/[projet]/import-cyber) puis liée par POST /api/projets/[id]/analyses.
// Affiché tant que le projet n'a pas d'analyse cyber liée (l'appelant le masque ensuite).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'

const field = 'rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800'

export default function AssocierAnalyseCyber({ projetId, canCreate, onLinked, compact = false }: {
  projetId: string; canCreate: boolean; onLinked?: (a: { id: string; nom: string }) => void; compact?: boolean
}) {
  const { t } = useTranslation()
  const a = t.projet360.associerCyber
  const p = t.projet360
  const [lier, setLier] = useState(false)
  const [q, setQ] = useState('')
  const [sources, setSources] = useState<{ id: string; nom: string }[] | null>(null)
  const [choix, setChoix] = useState('')
  const [erreur, setErreur] = useState(false)

  useEffect(() => {
    if (!lier || !q.trim()) return
    const h = setTimeout(() => {
      fetch(`/api/analyses/${projetId}/import-cyber?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : { sources: [] })).then(d => setSources(d.sources ?? [])).catch(() => setSources([]))
    }, 250)
    return () => clearTimeout(h)
  }, [q, lier, projetId])

  async function valider() {
    setErreur(false)
    const res = await fetch(`/api/projets/${projetId}/analyses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analyseId: choix }) }).catch(() => null)
    if (!res?.ok) { setErreur(true); return }
    const d = await res.json()
    onLinked?.(d.analyse)
  }

  return (
    <div className="relative inline-block text-left">
      <details>
        <summary className={`cursor-pointer list-none ${compact ? 'inline-flex items-center gap-1 rounded border border-ebios-300 px-2 py-0.5 text-xs font-medium text-ebios-700 hover:bg-ebios-50 dark:border-ebios-700 dark:hover:bg-gray-800' : 'btn-secondary text-sm'}`}>{a.bouton}</summary>
        <div className="absolute right-0 z-20 mt-1 w-72 space-y-2 rounded-lg border border-gray-200 bg-white p-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {canCreate && <Link href={`/analyses/new?projet=${projetId}`} className="block rounded px-2 py-1 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">{a.creer}</Link>}
          <button type="button" onClick={() => setLier(true)} className="block w-full rounded px-2 py-1 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">{a.lier}</button>
          {lier && (
            <div className="space-y-2 border-t border-gray-100 px-2 pt-2 dark:border-gray-800">
              <input aria-label={p.importSearch} type="search" value={q} placeholder={p.importSearchPlaceholder} onChange={e => setQ(e.target.value)} className={`${field} w-full`} />
              {sources && (sources.length === 0 ? <p className="text-xs italic text-gray-400">{p.importNoMatch}</p> : (
                <select aria-label={a.analyse} value={choix} onChange={e => setChoix(e.target.value)} className={`${field} w-full`}>
                  <option value="">—</option>
                  {sources.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              ))}
              <button type="button" disabled={!choix} onClick={valider} className="btn-primary text-xs disabled:opacity-50">{a.valider}</button>
              {erreur && <p role="alert" className="text-xs text-red-600">{a.erreur}</p>}
            </div>
          )}
        </div>
      </details>
    </div>
  )
}
