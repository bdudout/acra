'use client'
// ─── Liste paginée côté serveur : état dans l'URL + chargement (lot V1) ──────────────────
// Page, taille, tri, ordre, recherche et filtres sont dans l'URL (lien partageable, retour arrière).
// La recherche est envoyée après une courte pause de saisie. Voir lib/pagination (contrat serveur).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { MetaPagination } from '@/lib/pagination'

export interface ListePaginee<R> {
  data: R | null
  loading: boolean
  erreur: boolean
  pagination: MetaPagination | null
  /** Valeur d'un paramètre de vue (page, taille, tri, ordre, q ou filtre). */
  param: (cle: string) => string
  /** Modifie un ou plusieurs paramètres ; tout changement autre que la page revient à la page 1. */
  definir: (changements: Record<string, string | number | null>) => void
  /** Saisie de recherche (valeur immédiate) ; l'URL suit après une pause. */
  recherche: string
  setRecherche: (q: string) => void
  recharger: () => void
}

export function useListePaginee<R extends { pagination?: MetaPagination }>(url: string, defauts: Record<string, string> = {}): ListePaginee<R> {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [data, setData] = useState<R | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)
  const [tick, setTick] = useState(0)
  const [recherche, setRechercheLocale] = useState(sp.get('q') ?? '')
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)

  const param = useCallback((cle: string) => sp.get(cle) ?? defauts[cle] ?? '', [sp, defauts])

  // Paramètres courants lus au moment de l'appel (et non à la création du rappel) : la recherche
  // différée et deux changements rapprochés ne réintroduisent pas un filtre effacé entre-temps.
  const courants = useRef<URLSearchParams | ReturnType<typeof useSearchParams>>(sp)
  useEffect(() => { courants.current = sp }, [sp])

  const definir = useCallback((changements: Record<string, string | number | null>) => {
    const p = new URLSearchParams(courants.current.toString())
    for (const [k, v] of Object.entries(changements)) {
      if (v === null || v === '') p.delete(k); else p.set(k, String(v))
    }
    if (!('page' in changements)) p.delete('page')
    courants.current = p
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }, [router, pathname])

  const setRecherche = useCallback((q: string) => {
    setRechercheLocale(q)
    if (minuterie.current) clearTimeout(minuterie.current)
    minuterie.current = setTimeout(() => definir({ q: q.trim() || null }), 300)
  }, [definir])

  // Requête serveur : paramètres de l'URL + défauts, toujours paginée.
  const requete = useMemo(() => {
    const p = new URLSearchParams({ ...defauts, ...Object.fromEntries(sp.entries()) })
    if (!p.has('page')) p.set('page', '1')
    return `${url}${url.includes('?') ? '&' : '?'}${p.toString()}`
  }, [url, sp, defauts])

  useEffect(() => {
    let annule = false
    setLoading(true)
    fetch(requete)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: R) => { if (!annule) { setData(d); setErreur(false) } })
      .catch(() => { if (!annule) setErreur(true) })
      .finally(() => { if (!annule) setLoading(false) })
    return () => { annule = true }
  }, [requete, tick])

  return { data, loading, erreur, pagination: data?.pagination ?? null, param, definir, recherche, setRecherche, recharger: () => setTick(t => t + 1) }
}
