import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const nav = vi.hoisted(() => ({ params: new URLSearchParams('niveau=N1&page=2'), replace: vi.fn() }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => nav.params,
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/controles',
}))

import { useListePaginee } from '@/lib/use-liste-paginee'

beforeEach(() => {
  nav.replace.mockClear()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ controles: [], pagination: { page: 2, taille: 50, total: 60, pages: 2 } }))))
})

describe('useListePaginee', () => {
  it('interroge le serveur avec les paramètres de l\'URL (toujours paginé) et expose la pagination', async () => {
    const { result } = renderHook(() => useListePaginee('/api/controles'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/controles?niveau=N1&page=2')
    expect(result.current.pagination).toEqual({ page: 2, taille: 50, total: 60, pages: 2 })
    expect(result.current.param('niveau')).toBe('N1')
  })
  it('changer un filtre revient à la page 1 ; changer la page la conserve', async () => {
    const { result } = renderHook(() => useListePaginee('/api/controles'))
    act(() => result.current.definir({ etat: 'DU' }))
    expect(nav.replace).toHaveBeenLastCalledWith('/controles?niveau=N1&etat=DU', { scroll: false })
    act(() => result.current.definir({ page: 3 }))
    expect(nav.replace).toHaveBeenLastCalledWith('/controles?niveau=N1&etat=DU&page=3', { scroll: false })
    act(() => result.current.definir({ niveau: null, etat: null }))
    expect(nav.replace).toHaveBeenLastCalledWith('/controles?', { scroll: false })
  })
  it('la recherche différée ne réintroduit pas un filtre effacé entre-temps', async () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useListePaginee('/api/controles'))
      act(() => result.current.setRecherche('pare-feu'))
      act(() => result.current.definir({ niveau: null }))
      expect(nav.replace).toHaveBeenLastCalledWith('/controles?', { scroll: false })
      act(() => { vi.advanceTimersByTime(300) })
      expect(nav.replace).toHaveBeenLastCalledWith('/controles?q=pare-feu', { scroll: false })
    } finally { vi.useRealTimers() }
  })
})
