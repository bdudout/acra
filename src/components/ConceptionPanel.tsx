'use client'

// ─── Évaluation de la CONCEPTION d'un contrôle ───────────────────────────────
// Distincte de l'efficacité opérationnelle (calculée sur les exécutions) : le contrôle
// est-il bien pensé pour couvrir le risque ? Réservé à la 2ᵉ ligne (canEdit).

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { CONCEPTIONS } from '@/lib/controle-l3'

export interface ConceptionValue { statut: string; commentaire?: string; evalueLe?: string }
const inp = 'px-2 py-1.5 rounded-sm border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'

export default function ConceptionPanel({ conception, canEdit, busy, onSave }: {
  conception: ConceptionValue | null; canEdit: boolean; busy: boolean; onSave: (v: { statut: string; commentaire?: string } | null) => void
}) {
  const { t, locale } = useTranslation()
  const c = t.controles
  const labels = c.ctl_conceptions as Record<string, string>
  const [statut, setStatut] = useState(conception?.statut ?? '')
  const [commentaire, setCommentaire] = useState(conception?.commentaire ?? '')

  if (!canEdit) {
    return (
      <p className="text-xs text-gray-600 dark:text-gray-300"><span className="font-medium">{c.ctl_conceptionTitre} :</span> {conception ? labels[conception.statut] : c.ctl_conceptionNon}
        {conception?.commentaire && <span className="block text-gray-500">{conception.commentaire}</span>}</p>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-500">{c.ctl_conceptionHint}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-gray-500 dark:text-gray-400">{c.ctl_conceptionTitre}
          <select aria-label={c.ctl_conceptionTitre} value={statut} onChange={e => setStatut(e.target.value)} className={`${inp} block mt-1`}>
            <option value="">{c.ctl_conceptionNon}</option>
            {CONCEPTIONS.map(x => <option key={x} value={x}>{labels[x]}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400 flex-1 min-w-48">{c.ctl_conceptionCommentaire}
          <input aria-label={c.ctl_conceptionCommentaire} value={commentaire} maxLength={2000} onChange={e => setCommentaire(e.target.value)} className={`${inp} block w-full mt-1`} />
        </label>
        <button type="button" disabled={busy} onClick={() => onSave(statut ? { statut, ...(commentaire.trim() ? { commentaire: commentaire.trim() } : {}) } : null)} className="btn-secondary text-xs disabled:opacity-50">{c.save}</button>
      </div>
      {conception?.evalueLe && <p className="text-[11px] text-gray-400">{new Date(conception.evalueLe).toLocaleDateString(locale)}</p>}
    </div>
  )
}
