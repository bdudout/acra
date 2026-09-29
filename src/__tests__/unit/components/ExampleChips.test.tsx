import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ExampleChips from '@/components/ExampleChips'
import ModuleGuide from '@/components/ModuleGuide'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

describe('ExampleChips', () => {
  it('affiche les exemples et notifie le choix ; rien si la liste est vide', () => {
    const onPick = vi.fn()
    const { rerender, container } = render(<ExampleChips items={[{ id: 'a', label: 'Migration cloud' }, { id: 'b', label: 'Refonte portail' }]} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Refonte portail' }))
    expect(onPick).toHaveBeenCalledWith('b')
    rerender(<ExampleChips items={[]} onPick={onPick} />)
    expect(container.textContent).toBe('')
  })
})

describe('ModuleGuide', () => {
  it('présente à quoi ça sert, comment s’en servir et ce qu’on en tire (repliable)', () => {
    render(<ModuleGuide guide={{ what: 'Q1', how: 'Q2', result: 'Q3' }} />)
    for (const x of ['Q1', 'Q2', 'Q3']) expect(screen.getByText(x)).toBeTruthy()
    expect(screen.getByText('À quoi ça sert')).toBeTruthy()
    expect(screen.getByText('Comment s’en servir')).toBeTruthy()
    expect(screen.getByText('Ce que vous en tirez')).toBeTruthy()
  })
})
