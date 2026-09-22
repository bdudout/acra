'use client'

// ─── Conseils pédagogiques par phase (repliables, mémorisés) ─────────────────
// R2 du chantier multi-méthode : explique la démarche de chaque phase des
// parcours à saisie directe (ISO/IEC 27005, NIST SP 800-30, ISO 31000), au-dessus
// du contenu de la phase dans `PhasedRiskWorkshop`. Contenu = reformulation
// PÉDAGOGIQUE de la démarche (pas une copie des libellés normatifs ISO/NIST).
// L'état replié est partagé entre toutes les phases (une seule préférence
// utilisateur) et persisté en localStorage, comme AtelierGuidancePanel (EBIOS RM).

import { Lightbulb } from 'lucide-react'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'acra-phase-guidance-collapsed'

interface Props {
  /** Paragraphe d'introduction (démarche de la phase). */
  intro?: string
  /** Points clés de la phase (puces). */
  points?: readonly string[]
  /** Titre du panneau (i18n). */
  title: string
  /** Libellé du bouton « Masquer » (i18n). */
  hideLabel: string
  /** Libellé du bouton de réouverture quand replié (i18n). */
  showLabel: string
}

export default function PhaseGuidance({ intro, points, title, hideLabel, showLabel }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  // État replié persisté (lu après montage pour éviter un mismatch d'hydratation).
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === '1') } catch { /* mode privé */ }
  }, [])

  function toggle(next: boolean) {
    setCollapsed(next)
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch { /* quota / mode privé */ }
  }

  // Rien à afficher si la phase n'a pas de conseils.
  if (!intro && !(points && points.length)) return null

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => toggle(false)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-ebios-700 hover:border-ebios-200"
      >
        <Lightbulb size={14} aria-hidden="true" />{showLabel}
      </button>
    )
  }

  return (
    <section className="mb-4 rounded-lg border border-ebios-100 dark:border-ebios-900/40 bg-ebios-50/60 dark:bg-ebios-900/10 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ebios-800 dark:text-ebios-200">
          <Lightbulb size={16} aria-hidden="true" />{title}
        </h2>
        <button
          type="button"
          onClick={() => toggle(true)}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {hideLabel}
        </button>
      </div>
      {intro && <p className="text-sm text-gray-600 dark:text-gray-300">{intro}</p>}
      {points && points.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {points.map((p, i) => (
            <li key={i} className="flex gap-2 text-xs text-gray-600 dark:text-gray-400">
              <span className="mt-0.5 text-ebios-500">›</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
