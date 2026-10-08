// Filtre « Entité » (consolidation, lot E5) : options hiérarchiques du référentiel, sous-entités incluses par défaut,
// masqué tant que le référentiel est vide.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FiltreEntite from '@/components/FiltreEntite'
import type { EntiteRef } from '@/lib/entites'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const E = (id: string, nom: string, o: Partial<EntiteRef> = {}): EntiteRef => ({ id, nom, type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null, ...o })
const entites = [E('g', 'Groupe'), E('dsi', 'DSI', { parentId: 'g' })]

describe('FiltreEntite', () => {
  it('liste hiérarchique, choix transmis avec l’option sous-entités', () => {
    const onChange = vi.fn()
    render(<FiltreEntite entites={entites} valeur="" sousEntites onChange={onChange} />)
    const select = screen.getByLabelText('Entité') as HTMLSelectElement
    expect([...select.options].map(o => o.textContent)).toEqual(['Toutes les entités', 'Groupe', '  DSI'])
    fireEvent.change(select, { target: { value: 'g' } })
    expect(onChange).toHaveBeenCalledWith('g', true)
  })
  it('case « sous-entités » visible quand une entité est choisie', () => {
    const onChange = vi.fn()
    render(<FiltreEntite entites={entites} valeur="g" sousEntites onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('avec les sous-entités'))
    expect(onChange).toHaveBeenCalledWith('g', false)
  })
  it('référentiel vide : rien n’est affiché', () => {
    const { container } = render(<FiltreEntite entites={[]} valeur="" sousEntites onChange={() => {}} />)
    expect(container.innerHTML).toBe('')
  })
})
