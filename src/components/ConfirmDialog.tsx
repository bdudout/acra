'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
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
  /** Icône affichée. Défaut : corbeille. */
  icon?: ReactNode
  /** Couleur du bouton de confirmation. Défaut : danger (rouge). */
  variant?: ConfirmVariant
  /**
   * Confirmation PAR SAISIE : si fourni, l'opérateur doit taper EXACTEMENT ce texte
   * pour activer le bouton de confirmation (garde-fou pour les actions très
   * destructrices, ex. purge des organisations démo).
   */
  requireText?: string
  /** Libellé/consigne du champ de saisie (obligatoire si `requireText` est fourni). */
  requireTextLabel?: string
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
 * - Focus initial sur l'action sûre (Annuler), ou sur le champ de saisie si
 *   `requireText` est fourni.
 */
export default function ConfirmDialog({ message, onConfirm, onCancel, title, confirmLabel, icon, variant = 'danger', requireText, requireTextLabel }: Props) {
  const { t } = useTranslation()
  const cancelRef  = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const titleId    = 'confirm-dialog-title'
  const inputId    = 'confirm-dialog-require-text'

  const [typed, setTyped] = useState('')
  const confirmDisabled = requireText ? typed !== requireText : false

  // Focus initial : le champ de saisie s'il existe, sinon le bouton « Annuler ».
  useEffect(() => {
    (requireText ? inputRef.current : cancelRef.current)?.focus()
  }, [requireText])

  // Fermeture par Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Focus trap — Tab / Shift+Tab reste dans la dialog (ignore les éléments désactivés).
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return
    const focusable = [inputRef.current, cancelRef.current, confirmRef.current]
      .filter((el): el is NonNullable<typeof el> => !!el && !el.disabled)
    if (focusable.length === 0) return
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
          <span className="flex-shrink-0 text-gray-500" aria-hidden="true">{icon ?? <Trash2 size={24} aria-hidden="true" />}</span>
          <div>
            <h3 id={titleId} className="font-semibold text-gray-900 mb-1">
              {title ?? t.deleteDialog.title}
            </h3>
            <p className="text-sm text-gray-600">{message}</p>
          </div>
        </div>

        {requireText && (
          <div className="mb-5">
            <label htmlFor={inputId} className="block text-sm text-gray-600 mb-1">{requireTextLabel}</label>
            <input
              id={inputId}
              ref={inputRef}
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
        )}

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
            disabled={confirmDisabled}
            className={`text-white rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_BTN[variant]}`}
          >
            {confirmLabel ?? t.deleteDialog.confirmBtn}
          </button>
        </div>
      </div>
    </div>
  )
}
