import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PartyTierLink from '@/components/PartyTierLink'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const tiers = [
  { id: 't1', nom: 'Acme Logiciels', lei: '549300ABCDEFGHIJ1234', aliases: ['Acme SAS'] },
  { id: 't2', nom: 'Hébergeur TIC', lei: null, aliases: [] },
]

describe('PartyTierLink — identité du tiers d’une partie prenante', () => {
  it('sélection de l’identité : seul tierId change (nom, scores et criticité restent ceux de l’analyse)', () => {
    const onChange = vi.fn()
    render(<PartyTierLink name="Fournisseur X" tierId={null} tiers={tiers} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Identité du tiers'), { target: { value: 't2' } })
    expect(onChange).toHaveBeenCalledWith('t2')
    fireEvent.change(screen.getByLabelText('Identité du tiers'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
  it('propose un rapprochement quand le nom correspond (nom identique ou alias), jamais appliqué sans clic', () => {
    const onChange = vi.fn()
    render(<PartyTierLink name="ACME SAS" tierId={null} tiers={tiers} onChange={onChange} />)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText(/alias identique/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Rapprocher avec « Acme Logiciels »/ }))
    expect(onChange).toHaveBeenCalledWith('t1')
  })
  it('déjà rapprochée : pas de suggestion ; aucune identité connue : composant masqué ; lecture seule : liste désactivée', () => {
    const { rerender, container } = render(<PartyTierLink name="Acme SAS" tierId="t1" tiers={tiers} onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Rapprocher/ })).toBeNull()
    rerender(<PartyTierLink name="Acme SAS" tierId={null} tiers={[]} onChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<PartyTierLink name="X" tierId="t1" tiers={tiers} disabled onChange={vi.fn()} />)
    expect(screen.getByLabelText('Identité du tiers')).toBeDisabled()
  })
  it('identité retirée de la liste (accès révoqué) : le lien existant reste affiché comme tel, sans casser la saisie', () => {
    render(<PartyTierLink name="X" tierId="tDisparu" tiers={tiers} onChange={vi.fn()} />)
    expect((screen.getByLabelText('Identité du tiers') as HTMLSelectElement).value).toBe('tDisparu')
    expect(screen.getByRole('option', { name: 'Identité non accessible' })).toBeInTheDocument()
  })
})
