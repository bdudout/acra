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

describe('useAutoSave — reprise automatique après échec', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('échec réessayable → nouvelle tentative avec délai croissant, jusqu\'au succès', async () => {
    const saveFn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('réseau'), { reessayable: true }))
      .mockRejectedValueOnce(Object.assign(new Error('réseau'), { reessayable: true }))
      .mockResolvedValue(undefined)
    const { result, rerender } = renderHook(({ d }) => useAutoSave(d, saveFn, { delay: 100 }), { initialProps: { d: 1 } })
    rerender({ d: 2 })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('error')
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(saveFn).toHaveBeenCalledTimes(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
    expect(saveFn).toHaveBeenCalledTimes(3)
    expect(saveFn).toHaveBeenLastCalledWith(2)
    expect(result.current.status).toBe('saved')
  })
  it('échec non réessayable (conflit) → aucune nouvelle tentative', async () => {
    const saveFn = vi.fn().mockRejectedValue(Object.assign(new Error('conflit'), { reessayable: false }))
    const { result, rerender } = renderHook(({ d }) => useAutoSave(d, saveFn, { delay: 100 }), { initialProps: { d: 1 } })
    rerender({ d: 2 })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('error')
  })
})
