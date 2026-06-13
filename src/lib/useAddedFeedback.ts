/**
 * useAddedFeedback — rétroaction visuelle temporaire sur les boutons "ajouter depuis exemple"
 *
 * Usage :
 *   const { flash, isAdded } = useAddedFeedback()
 *   <button onClick={() => { addItem(x); flash(`key-${i}`) }}
 *           className={isAdded(`key-${i}`) ? 'added-style' : 'normal-style'}>
 *     {isAdded(`key-${i}`) ? '✓ Ajouté' : 'Nom item'}
 *   </button>
 */

import { useState, useCallback } from 'react'

export interface AddedFeedbackResult {
  /** Déclenche le feedback pour une clé donnée pendant `duration` ms */
  flash: (key: string) => void
  /** Retourne true si la clé est en cours de feedback */
  isAdded: (key: string) => boolean
}

export function useAddedFeedback(duration = 2000): AddedFeedbackResult {
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())

  const flash = useCallback((key: string) => {
    setAddedKeys(prev => new Set([...prev, key]))
    setTimeout(() => {
      setAddedKeys(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }, duration)
  }, [duration])

  const isAdded = useCallback((key: string) => addedKeys.has(key), [addedKeys])

  return { flash, isAdded }
}
