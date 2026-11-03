'use client'
// ─── Filtres de risques synchronisés avec l'URL (cartographie / pilotage) ────────────────
// État initial lu depuis l'URL (parseFilters) ; chaque changement fait router.replace (même
// choix que useListePaginee), les autres paramètres sont conservés. L'URL est la source de
// vérité : le retour arrière du navigateur restaure donc les filtres.
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { fusionnerFiltresDansParams, parseFilters, type RiskFilters } from '@/lib/risk-filters'

export function useFiltresUrl(): [RiskFilters, (f: RiskFilters) => void] {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const cle = sp.toString()
  const filters = useMemo(() => parseFilters(new URLSearchParams(cle)), [cle])
  // Paramètres lus au moment de l'appel : deux changements rapprochés ne s'écrasent pas.
  const courants = useRef(cle)
  useEffect(() => { courants.current = cle }, [cle])

  const setFilters = useCallback((f: RiskFilters) => {
    const qs = fusionnerFiltresDansParams(courants.current, f)
    courants.current = qs
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname])

  return [filters, setFilters]
}
