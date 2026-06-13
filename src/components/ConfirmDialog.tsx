'use client'

import { useEffect, useRef } from 'react'
import { useTranslation } from '@/lib/i18n/context'

type ConfirmVariant = 'danger' | 'warning' | 'primary' | 'success'

interface Props {
  message: string
  onConfirm: () => void
  onCancel: () => void
  /** Titre de la dialog. Défaut : « Confirmer la suppression ». */
  title?: string
  /** Libellé du bouton de confirmation. Défaut : « Supprimer ». */
  confirmLabel?: string
  /** Émoji affiché. Défaut : 🗑️. */
  icon?: string
  /** Couleur du bouton de confirmation. Défaut : danger (rouge). */
  variant?: ConfirmVariant
}

const VARIANT_BTN: Record<ConfirmVariant, string> = {
  danger:  'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600',
  warning: 'bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-500',
  primary: 'bg-ebios-600 hover:bg-ebios-700 focus-visible:ring-ebios-600',
  success: 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-600',
}

/**
 * Boîte de dialogue de confirmation accessible (RGAA 7.1 / WCAG 4.1.2).
 * - role="dialog" + aria-modal="true" + aria-labelledby
 * - Focus trap : Tab/Shift+Tab circulent uniquement dans la dialog
 * - Fermeture par Escape
 * - Focus placé sur le bouton "Annuler" à l'ouverture (action sûre par défaut)
 */
export default function ConfirmDialog({ message, onConfirm, onCancel, title, confirmLabel, icon, variant = 'danger' }: Props) {
  const { t } = useTranslation()
  const cancelRef  = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const titleId    = 'confirm-dialog-title'

  // Focus sur le bouton annuler à l'ouverture
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  // Fermeture par Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Focus trap — Tab / Shift+Tab reste dans la dialog
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return
    const focusable = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[]
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      aria-hidden="true"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start gap-3 mb-5">
          <span className="text-2xl flex-shrink-0" aria-hidden="true">{icon ?? '🗑️'}</span>
          <div>
            <h3 id={titleId} className="font-semibold text-gray-900 mb-1">
              {title ?? t.deleteDialog.title}
            </h3>
            <p className="text-sm text-gray-600">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="btn-secondary text-sm py-1.5 px-4"
          >
            {t.deleteDialog.cancelBtn}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`text-white rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 ${VARIANT_BTN[variant]}`}
          >
            {confirmLabel ?? t.deleteDialog.confirmBtn}
          </button>
        </div>
      </div>
    </div>
  )
}
