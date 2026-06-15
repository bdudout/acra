'use client'

import { useMemo } from 'react'
import { useTranslation } from './context'
import { getEbiosData } from '../ebios-data-i18n'

/**
 * Hook client : renvoie les exports d'ebios-data localisés selon la locale
 * active (repli FR automatique). Mémoïsé sur la locale pour éviter de
 * reconstruire l'objet à chaque rendu.
 *
 * Exemple : `const { SOURCES_RISQUE_EXEMPLES } = useEbiosData()`
 */
export function useEbiosData() {
  const { locale } = useTranslation()
  return useMemo(() => getEbiosData(locale), [locale])
}
