'use client'

/**
 * ExpressAnalyseButton — bouton + modal de création d'une analyse express.
 *
 * Mode express : crée une analyse et passe directement en atelier 1
 * avec accès débridé à tous les ateliers (atelierCourant = 5).
 * L'utilisateur n'est guidé que par A1 → A2 → A5.
 *
 * Utilisé sur : /dashboard, /analyses
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'

interface Props {
  /** Variante visuelle : 'button' pour le header, 'link' pour la liste d'accès rapide */
  variant?: 'button' | 'link'
}

export default function ExpressAnalyseButton({ variant = 'button' }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const e = t.analyses
  const quickLabel = t.dashboard.quickExpress

  const [showModal, setShowModal]   = useState(false)
  const [nom, setNom]               = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  function openModal() {
    setNom('')
    setError('')
    setShowModal(true)
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!nom.trim()) { setError(e.expressRequired); return }
    setLoading(true)
    setError('')
    try {
      // Créer l'analyse
      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: nom.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur création')
      const id = data.analyse.id
      // Débloquer tous les ateliers pour le mode express
      await fetch(`/api/analyses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atelierCourant: 5 }),
      })
      router.push(`/analyses/${id}/atelier/1?mode=express`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <>
      {variant === 'button' ? (
        <button
          onClick={openModal}
          className="btn-secondary flex items-center gap-2 text-sm text-amber-700 border-amber-300 hover:bg-amber-50"
          title={e.expressSubtitle}
        >
          {e.expressBtn}
        </button>
      ) : (
        <button
          onClick={openModal}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-amber-50 text-sm text-amber-700 w-full text-left"
        >
          ⚡ {quickLabel}
        </button>
      )}

      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={ev => ev.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">⚡</span>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{e.expressTitle}</h2>
                <p className="text-sm text-gray-500">{e.expressSubtitle}</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
              <p className="text-xs text-amber-800">{e.expressInfo}</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">
                  {t.newAnalysis.name} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={nom}
                  onChange={ev => setNom(ev.target.value)}
                  className="input"
                  placeholder={e.expressNamePh}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  {t.newAnalysis.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                >
                  {loading ? e.expressStarting : e.expressStart}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
