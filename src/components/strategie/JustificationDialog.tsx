'use client'

// ─── Stratégie : boîte de saisie de la justification (lot S1b) ───────────────
// Après validation, toute évolution (cadre non figé, rattachement, retrait) exige une justification : la boîte
// s'ouvre avant l'envoi, le focus va sur le champ, la confirmation reste impossible tant qu'il est vide, Échap annule.
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { JUSTIFICATION_MAX } from '@/lib/strategie'

export default function JustificationDialog({ onConfirm, onCancel }: { onConfirm: (justification: string) => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const j = t.strategie.ui.justification
  const [texte, setTexte] = useState('')
  const champRef = useRef<HTMLTextAreaElement>(null)
  const titreId = useId()
  const aideId = useId()
  const champId = useId()
  const valeur = texte.trim()

  // Focus sur le champ à l'ouverture ; rendu au déclencheur à la fermeture.
  useEffect(() => {
    const declencheur = document.activeElement instanceof HTMLElement ? document.activeElement : null
    champRef.current?.focus()
    return () => { if (declencheur?.isConnected) declencheur.focus() }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Piège à focus : Tab circule entre les éléments actifs de la boîte.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return
    const el = [...e.currentTarget.querySelectorAll<HTMLElement>('textarea, button:not([disabled])')]
    if (!el.length) return
    const premier = el[0], dernier = el[el.length - 1]
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus() }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby={titreId} aria-describedby={aideId} onKeyDown={onKeyDown}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 space-y-3">
        <h3 id={titreId} className="font-semibold text-gray-900 dark:text-gray-100">{j.titre}</h3>
        <p id={aideId} className="text-sm text-gray-600 dark:text-gray-300">{j.aide}</p>
        <div>
          <label htmlFor={champId} className="block text-sm text-gray-700 dark:text-gray-200 mb-1">{j.champ}</label>
          <textarea id={champId} ref={champRef} required rows={3} maxLength={JUSTIFICATION_MAX} value={texte}
            onChange={e => setTexte(e.target.value)}
            className="w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-900 dark:border-gray-600" />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary text-sm py-1.5 px-4">{t.strategie.ui.annuler}</button>
          <button type="button" disabled={!valeur} onClick={() => onConfirm(valeur)} className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50">{j.confirmer}</button>
        </div>
      </div>
    </div>
  )
}
