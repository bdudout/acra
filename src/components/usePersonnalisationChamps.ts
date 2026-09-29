'use client'

// Définitions des champs personnalisés d'un module (lot L5), déjà réduites aux champs accessibles au rôle
// courant par l'API. Liste vide tant que non chargée ou en cas d'échec.
import { useEffect, useState } from 'react'
import type { ChampDef, ChampsModule } from '@/lib/champs-perso'

export function usePersonnalisationChamps(module: ChampsModule): ChampDef[] {
  const [defs, setDefs] = useState<ChampDef[]>([])
  useEffect(() => {
    let vivant = true
    fetch('/api/personnalisation').then(r => (r.ok ? r.json() : null)).then(d => { if (vivant) setDefs(Array.isArray(d?.champs?.[module]) ? d.champs[module] : []) }).catch(() => {})
    return () => { vivant = false }
  }, [module])
  return defs
}
