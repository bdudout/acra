// Page RGPD : onglets « responsable » / « sous-traitant » seulement si le registre du sous-traitant est activé.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RgpdOnglets from '@/components/RgpdOnglets'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('@/components/RopaManager', () => ({ default: () => <p>registre du responsable</p> }))
vi.mock('@/components/RopaSousTraitanceManager', () => ({ default: () => <p>registre du sous-traitant</p> }))

describe('RgpdOnglets', () => {
  it('module inactif : registre du responsable seul, sans onglets', () => {
    render(<RgpdOnglets sousTraitant={false} />)
    expect(screen.getByText('registre du responsable')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).toBeNull()
  })
  it('module actif : deux onglets', () => {
    render(<RgpdOnglets sousTraitant />)
    expect(screen.getByRole('tab', { name: 'Registre du responsable du traitement (art. 30, § 1)' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Registre du sous-traitant (art. 30, § 2)' }))
    expect(screen.getByText('registre du sous-traitant')).toBeInTheDocument()
    expect(screen.queryByText('registre du responsable')).toBeNull()
  })
})

// Recette n° 7 : le DPO ne savait pas que le registre du sous-traitant existait → une ligne explique comment l'obtenir ;
// lien vers la configuration des fonctionnalités pour l'administrateur seulement.
describe('RgpdOnglets — registre du sous-traitant désactivé', () => {
  it('DPO : explication, sans lien de configuration', () => {
    render(<RgpdOnglets sousTraitant={false} estAdmin={false} />)
    expect(screen.getByText(/demandez à l’administrateur/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })
  it('administrateur : lien vers la configuration des fonctionnalités', () => {
    render(<RgpdOnglets sousTraitant={false} estAdmin />)
    expect(screen.getByRole('link', { name: /Activer le registre du sous-traitant/ })).toHaveAttribute('href', '/configuration')
  })
  it('module actif : pas d’explication', () => {
    render(<RgpdOnglets sousTraitant estAdmin={false} />)
    expect(screen.queryByText(/demandez à l’administrateur/)).toBeNull()
  })
})
