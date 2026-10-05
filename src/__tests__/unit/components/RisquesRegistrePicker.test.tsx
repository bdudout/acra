import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RisquesRegistrePicker from '@/components/RisquesRegistrePicker'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const risks = [{ id: 'r1', intitule: 'Déni de service sur les services en ligne' }, { id: 'r2', intitule: 'Fraude au virement' }, { id: 'r3', intitule: 'Indisponibilité du centre de données' }]

describe('RisquesRegistrePicker', () => {
  it('recherche (sans accents ni casse), coche plusieurs risques, affiche et retire les choisis', () => {
    const onChange = vi.fn()
    const { rerender } = render(<RisquesRegistrePicker risks={risks} value={[]} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Rechercher un risque du registre'), { target: { value: 'deni' } })
    expect(screen.queryByRole('checkbox', { name: 'Fraude au virement' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Déni de service sur les services en ligne' }))
    expect(onChange).toHaveBeenLastCalledWith(['r1'])
    rerender(<RisquesRegistrePicker risks={risks} value={['r1', 'r3']} onChange={onChange} />)
    expect(screen.getByText('2 risque(s) associé(s)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retirer Indisponibilité du centre de données' }))
    expect(onChange).toHaveBeenLastCalledWith(['r1'])
  })
  it('aucun résultat : message', () => {
    render(<RisquesRegistrePicker risks={risks} value={[]} onChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Rechercher un risque du registre'), { target: { value: 'zzz' } })
    expect(screen.getByText('Aucun risque ne correspond.')).toBeTruthy()
  })
})
