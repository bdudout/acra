'use client'

// ─── Réalisations rattachées à une ligne de plan (lot P4) ─────────────────────
// Rapprochements proposés (processus ou risques en commun, période dans l'année) puis autres missions, contrôles et
// campagnes de l'année ; enregistrement par le préparateur, possible même sur une année validée (on trace
// l'exécution). API : /api/plans/[id]/lignes/[ligneId]/realisations.
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { CandidatRealisation, Realisation } from '@/lib/planification'

interface Donnees { rattachees: Realisation[]; propositions: CandidatRealisation[]; candidats: CandidatRealisation[]; peutModifier: boolean }
const cle = (r: { type: string; id: string }) => `${r.type}:${r.id}`

export default function RealisationsPanel({ planId, ligneId, onClose }: { planId: string; ligneId: string; onClose: (modifie: boolean) => void }) {
  const { t } = useTranslation()
  const p = t.plans
  const [d, setD] = useState<Donnees | null>(null)
  const [choix, setChoix] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/plans/${planId}/lignes/${ligneId}/realisations`).then(r => (r.ok ? r.json() : null)).then((j: Donnees | null) => {
      if (!j) return
      setD(j); setChoix(new Set(j.rattachees.map(cle)))
    }).catch(() => {})
  }, [planId, ligneId])

  if (!d) return <p className="text-sm text-gray-400">…</p>
  const proposes = new Set(d.propositions.map(cle))
  const autres = d.candidats.filter(c => !proposes.has(cle(c)) && (!q || c.intitule.toLowerCase().includes(q.toLowerCase()))).slice(0, 100)
  const basculer = (k: string) => setChoix(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })

  async function enregistrer() {
    const realisations = [...choix].map(k => { const [type, ...reste] = k.split(':'); return { type, id: reste.join(':') } })
    const r = await fetch(`/api/plans/${planId}/lignes/${ligneId}/realisations`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ realisations }) }).catch(() => null)
    if (r?.ok) { onClose(true); return }
    const code = r ? ((await r.json().catch(() => ({}))) as { error?: string }).error : undefined
    setErreur((p.erreurs as Record<string, string>)[code ?? ''] ?? p.erreurs.defaut)
  }

  const ligne = (c: CandidatRealisation) => (
    <label key={cle(c)} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-200">
      <input type="checkbox" disabled={!d.peutModifier} checked={choix.has(cle(c))} onChange={() => basculer(cle(c))} aria-label={`${p.typesRealisation[c.type]} : ${c.intitule}`} />
      <span>{c.intitule} <span className="text-gray-400">· {p.typesRealisation[c.type]}{c.debut && c.type !== 'CONTROLE' ? ` · ${c.debut}` : ''}</span></span>
    </label>
  )

  return (
    <div className="rounded-lg border border-ebios-200 dark:border-ebios-500/30 bg-ebios-50/40 dark:bg-ebios-500/5 p-3 space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{p.rattachement.propositions}</p>
        {d.propositions.length === 0 ? <p className="text-xs italic text-gray-400">{p.rattachement.aucuneProposition}</p>
          : <div className="space-y-1 mt-1">{d.propositions.map(ligne)}</div>}
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{p.rattachement.autres}</p>
        <input aria-label={`${p.rattachement.autres} : ${p.rechercher}`} value={q} onChange={e => setQ(e.target.value)} placeholder={p.rechercher} className="mt-1 w-full rounded-sm border border-gray-300 px-2 py-1 text-xs dark:bg-gray-800 dark:border-gray-600" />
        <div className="max-h-40 overflow-y-auto mt-1 space-y-1">{autres.map(ligne)}</div>
      </div>
      {erreur && <p role="alert" className="text-xs text-red-600">{erreur}</p>}
      <div className="flex gap-2">
        {d.peutModifier && <button type="button" onClick={enregistrer} className="btn-primary text-xs">{p.enregistrer}</button>}
        <button type="button" onClick={() => onClose(false)} className="btn-secondary text-xs">{p.annuler}</button>
      </div>
    </div>
  )
}
