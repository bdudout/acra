'use client'

// ─── Référentiel des entités côté client (consolidation, lot E5) ──────────────
// Chargé une fois pour les filtres et sélecteurs d'entité ; liste vide si l'API est indisponible ou le référentiel vide.
import { useEffect, useState } from 'react'
import type { EntiteRef } from './entites'

type EntiteApi = Omit<EntiteRef, 'valideAu' | 'alias'> & { alias: unknown; valideAu: string | null }

export function useReferentielEntites(): EntiteRef[] {
  const [entites, setEntites] = useState<EntiteRef[]>([])
  useEffect(() => {
    let actif = true
    fetch('/api/referentiel-entites').then(r => (r.ok ? r.json() : null))
      .then((j: { entites?: EntiteApi[] } | null) => {
        if (!actif || !Array.isArray(j?.entites)) return
        setEntites(j.entites.map(e => ({ ...e, alias: Array.isArray(e.alias) ? (e.alias as string[]) : [], valideAu: e.valideAu ? new Date(e.valideAu) : null })))
      }).catch(() => {})
    return () => { actif = false }
  }, [])
  return entites
}
