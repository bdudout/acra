'use client'
// ─── « Associer un projet » à une analyse cyber sans projet (menu) ────────────
// Créer un nouveau projet 360 lié à l'analyse (/projets/nouveau?analyse=…) ou lier un projet existant (liste des
// projets accessibles, filtrée à la saisie) via POST /api/projets/[id]/analyses ; la page est ensuite rafraîchie
// (bascule analyse ⇄ projet, qualification reprise du projet).

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'

const field = 'rounded-sm border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800'
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function AssocierProjet({ analyseId }: { analyseId: string }) {
  const { t } = useTranslation()
  const a = t.associerProjet
  const router = useRouter()
  const [lier, setLier] = useState(false)
  const [projets, setProjets] = useState<{ id: string; nom: string }[] | null>(null)
  const [q, setQ] = useState('')
  const [choix, setChoix] = useState('')
  const [erreur, setErreur] = useState(false)

  useEffect(() => {
    if (!lier || projets) return
    fetch('/api/projets', { cache: 'no-store' }).then(r => (r.ok ? r.json() : { projets: [] })).then(d => setProjets(d.projets ?? [])).catch(() => setProjets([]))
  }, [lier, projets])
  const visibles = useMemo(() => (projets ?? []).filter(p => !q.trim() || norm(p.nom).includes(norm(q.trim()))).slice(0, 30), [projets, q])

  async function valider() {
    setErreur(false)
    const res = await fetch(`/api/projets/${choix}/analyses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analyseId }) }).catch(() => null)
    if (!res?.ok) { setErreur(true); return }
    router.refresh()
  }

  return (
    <div className="relative inline-block text-left">
      <details>
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-ebios-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800">{a.bouton}</summary>
        <div className="absolute left-0 z-20 mt-1 w-72 space-y-2 rounded-lg border border-gray-200 bg-white p-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <Link href={`/projets/nouveau?analyse=${analyseId}`} className="block rounded-sm px-2 py-1 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">{a.creer}</Link>
          <button type="button" onClick={() => setLier(true)} className="block w-full rounded-sm px-2 py-1 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">{a.lier}</button>
          {lier && (
            <div className="space-y-2 border-t border-gray-100 px-2 pt-2 dark:border-gray-800">
              <input aria-label={a.recherche} type="search" value={q} onChange={e => setQ(e.target.value)} className={`${field} w-full`} />
              {projets && (visibles.length === 0 ? <p className="text-xs italic text-gray-400">{a.aucun}</p> : (
                <select aria-label={a.projet} value={choix} onChange={e => setChoix(e.target.value)} className={`${field} w-full`}>
                  <option value="">—</option>
                  {visibles.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
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
