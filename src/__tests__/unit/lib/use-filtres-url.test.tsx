import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const nav = vi.hoisted(() => ({ params: new URLSearchParams('tab=x&statut=OUVERT&mode=inherent'), replace: vi.fn() }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => nav.params,
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/cartographie',
}))

import { useFiltresUrl } from '@/lib/use-filtres-url'

beforeEach(() => { nav.replace.mockClear() })

describe('useFiltresUrl', () => {
  it('lit les filtres initiaux depuis l\'URL', () => {
    const { result } = renderHook(() => useFiltresUrl())
    expect(result.current[0].statut).toBe('OUVERT')
    expect(result.current[0].mode).toBe('inherent')
  })
  it('un changement fait router.replace en conservant les autres paramètres', () => {
    const { result } = renderHook(() => useFiltresUrl())
    act(() => result.current[1]({ ...result.current[0], niveau: 'eleve' }))
    expect(nav.replace).toHaveBeenLastCalledWith('/cartographie?tab=x&statut=OUVERT&niveau=eleve&mode=inherent', { scroll: false })
  })
  it('réinitialiser ne retire que les filtres', () => {
    const { result } = renderHook(() => useFiltresUrl())
    act(() => result.current[1]({}))
    expect(nav.replace).toHaveBeenLastCalledWith('/cartographie?tab=x', { scroll: false })
  })
  it('sans paramètre restant, pas de point d\'interrogation', () => {
    nav.params = new URLSearchParams('statut=A')
    const { result } = renderHook(() => useFiltresUrl())
    act(() => result.current[1]({}))
    expect(nav.replace).toHaveBeenLastCalledWith('/cartographie', { scroll: false })
  })
})
