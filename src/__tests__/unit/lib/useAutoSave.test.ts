// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoSave } from '../../../lib/useAutoSave'

// Régression #102 : le debounce ne flushait pas au démontage → la dernière saisie
// pouvait être perdue (clic Navbar / fermeture d'onglet dans la fenêtre de debounce).

describe('useAutoSave — flush du dernier edit', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('flush au démontage si une sauvegarde est en attente', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { rerender, unmount } = renderHook(
      ({ d }) => useAutoSave(d, saveFn, { delay: 1500 }),
      { initialProps: { d: 1 } },
    )
    rerender({ d: 2 }) // planifie un save (debounce), rien n'a encore été appelé
    expect(saveFn).not.toHaveBeenCalled()
    act(() => { unmount() }) // démontage avant l'échéance → flush
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenCalledWith(2)
  })

  it('ne flush pas si rien n\'est en attente (aucune modification)', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { unmount } = renderHook(() => useAutoSave(1, saveFn, { delay: 1500 }))
    act(() => { unmount() })
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('sauvegarde normalement après le délai de debounce (pas de double save au démontage)', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { rerender, unmount } = renderHook(
      ({ d }) => useAutoSave(d, saveFn, { delay: 1500 }),
      { initialProps: { d: 1 } },
    )
    rerender({ d: 2 })
    act(() => { vi.advanceTimersByTime(1500) }) // l'échéance déclenche le save
    expect(saveFn).toHaveBeenCalledTimes(1)
    act(() => { unmount() }) // plus rien en attente → pas de second save
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('flush au démontage utilise la DERNIÈRE valeur', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { rerender, unmount } = renderHook(
      ({ d }) => useAutoSave(d, saveFn, { delay: 1500 }),
      { initialProps: { d: 1 } },
    )
    rerender({ d: 2 })
    rerender({ d: 3 }) // nouvelle frappe, remplace le debounce précédent
    act(() => { unmount() })
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenCalledWith(3)
  })
})
