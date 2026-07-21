'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

type Statut = 'EN_ATTENTE' | 'ACCEPTES' | 'REFUSES' | string

/**
 * Panneau d'acceptation des RISQUES RÉSIDUELS (acceptation du risque, portée globale),
 * DISTINCTE de la validation de l'analyse. Affiché sur la page d'une analyse lorsque la
 * fonctionnalité est active (OrganizationConfig.acceptationRisquesActive). Seule la
 * Direction métier (ou un admin) peut agir (`canAct`).
 */
export default function ResidualRisksPanel({
  analyseId, statut: statut0, le: le0, commentaire: commentaire0, canAct, locale,
}: {
  analyseId: string
  statut: Statut
  le: string | null
  commentaire: string | null
  canAct: boolean
  locale: string
}) {
  const { t } = useTranslation()
  const r = t.residualRisks
  const [statut, setStatut] = useState<Statut>(statut0)
  const [le, setLe] = useState<string | null>(le0)
  const [commentaire, setCommentaire] = useState<string>(commentaire0 ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(action: 'ACCEPTER' | 'REFUSER' | 'REINITIALISER') {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/analyses/${analyseId}/accept-residual-risks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, commentaire }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Erreur'); return }
      setStatut(data.risquesResiduelsStatut)
      setLe(data.risquesResiduelsLe ?? null)
      setCommentaire(data.risquesResiduelsCommentaire ?? '')
    } finally { setBusy(false) }
  }

  const badge =
    statut === 'ACCEPTES' ? { cls: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300', label: r.acceptedBadge }
    : statut === 'REFUSES' ? { cls: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300', label: r.refusedBadge }
    : { cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', label: r.pendingBadge }

  const dateStr = le ? new Date(le).toLocaleDateString(locale) : null

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">{r.title}</h2>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{r.subtitle}</p>

      {statut !== 'EN_ATTENTE' && dateStr && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {statut === 'ACCEPTES' ? r.acceptedOn : r.refusedOn} {dateStr}
          {commentaire && <> — « {commentaire} »</>}
        </p>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mb-3">{error}</div>}

      {canAct ? (
        <div className="space-y-3">
          <textarea
            value={commentaire}
            onChange={e => setCommentaire(e.target.value)}
            placeholder={r.commentPlaceholder}
            rows={2}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => decide('ACCEPTER')} disabled={busy}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium">
              {r.accept}
            </button>
            <button onClick={() => decide('REFUSER')} disabled={busy}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium">
              {r.refuse}
            </button>
            {statut !== 'EN_ATTENTE' && (
              <button onClick={() => decide('REINITIALISER')} disabled={busy}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800">
                {r.reset}
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500">{r.readOnlyHint}</p>
      )}
    </div>
  )
}
