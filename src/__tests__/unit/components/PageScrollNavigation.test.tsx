import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PageScrollNavigation from '@/components/PageScrollNavigation'

const labels = { group: 'Navigation dans la page', top: 'Aller en haut de la page', bottom: 'Aller en bas de la page' }

beforeEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 900 })
  Object.defineProperty(document.body, 'scrollHeight', { configurable: true, value: 900 })
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: true })) })
  window.scrollTo = vi.fn()
})

describe('PageScrollNavigation', () => {
  it('reste masqué tant que la page ne dépasse pas suffisamment la fenêtre', () => {
    render(<PageScrollNavigation {...labels} />)
    expect(screen.queryByRole('group', { name: labels.group })).not.toBeInTheDocument()
  })

  it('affiche les accès haut/bas et défile sans animation si la réduction des mouvements est demandée', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 1800 })
    Object.defineProperty(document.body, 'scrollHeight', { configurable: true, value: 1800 })
    render(<PageScrollNavigation {...labels} />)

    fireEvent.click(screen.getByRole('button', { name: labels.top }))
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' })

    fireEvent.click(screen.getByRole('button', { name: labels.bottom }))
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 1800, behavior: 'auto' })
  })

  it('réévalue sa visibilité après un redimensionnement', () => {
    const { rerender } = render(<PageScrollNavigation {...labels} />)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()

    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 1800 })
    Object.defineProperty(document.body, 'scrollHeight', { configurable: true, value: 1800 })
    fireEvent(window, new Event('resize'))
    rerender(<PageScrollNavigation {...labels} />)
    expect(screen.getByRole('group', { name: labels.group })).toBeInTheDocument()
  })
})
