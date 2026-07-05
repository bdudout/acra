/**
 * useAutoSave — Hook d'auto-sauvegarde avec debounce
 *
 * Usage :
 *   const { status, lastSaved, saveNow } = useAutoSave(data, saveFn, { delay: 1500 })
 *
 * - Déclenche saveFn() après `delay` ms d'inactivité (debounce)
 * - Expose un statut : 'idle' | 'pending' | 'saving' | 'saved' | 'error'
 * - saveNow() force la sauvegarde immédiate (ex: avant navigation)
 * - Ne sauvegarde pas si data === null (initialisation)
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface AutoSaveOptions {
  /** Délai en ms avant déclenchement de la sauvegarde (default: 1500) */
  delay?: number
  /** Ne pas sauvegarder automatiquement — utile quand la donnée est en cours de chargement */
  disabled?: boolean
}

export interface AutoSaveResult {
  status: AutoSaveStatus
  lastSaved: Date | null
  error: string | null
  /** Force la sauvegarde immédiate, retourne une promesse */
  saveNow: () => Promise<void>
}

export function useAutoSave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  options: AutoSaveOptions = {}
): AutoSaveResult {
  const { delay = 1500, disabled = false } = options

  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveFnRef = useRef(saveFn)
  const dataRef = useRef(data)
  const isFirstRender = useRef(true)
  // Vrai tant qu'une modification est en attente de sauvegarde (debounce en cours).
  const pendingRef = useRef(false)

  // Toujours garder la référence à jour pour éviter les stale closures
  saveFnRef.current = saveFn
  dataRef.current = data

  const save = useCallback(async (valueToSave: T) => {
    pendingRef.current = false
    setStatus('saving')
    setError(null)
    try {
      await saveFnRef.current(valueToSave)
      setStatus('saved')
      setLastSaved(new Date())
      // Revenir à idle après 3s pour ne pas afficher "sauvegardé" indéfiniment
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Erreur de sauvegarde')
    }
  }, [])

  // Debounce automatique à chaque changement de data
  useEffect(() => {
    // Ne pas sauvegarder au premier rendu (données initiales chargées depuis la DB)
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (disabled) return

    if (timerRef.current) clearTimeout(timerRef.current)
    setStatus('pending')
    pendingRef.current = true

    timerRef.current = setTimeout(() => {
      save(dataRef.current)
    }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // On veut se re-déclencher à chaque changement de `data`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, delay, disabled, save])

  // Flush du dernier edit si une sauvegarde est en attente au moment où l'on quitte :
  // démontage (navigation SPA, clic Navbar) ou fermeture d'onglet (beforeunload/pagehide).
  // Évite la perte silencieuse de la dernière saisie pendant la fenêtre de debounce.
  useEffect(() => {
    const flush = () => {
      if (!pendingRef.current) return
      pendingRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      // Fire-and-forget : le composant peut être démonté → pas de setState ici,
      // on appelle directement la fonction de sauvegarde avec la dernière valeur.
      void saveFnRef.current(dataRef.current)
    }
    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  // saveNow : annule le debounce en cours et sauvegarde immédiatement
  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    await save(dataRef.current)
  }, [save])

  return { status, lastSaved, error, saveNow }
}
