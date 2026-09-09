import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EcosystemFullView, { type FullTier } from '@/components/EcosystemFullView'

// Radar mocké : on n'affiche que le nombre de tiers reçus, pour observer le filtrage.
vi.mock('@/components/EcosystemRadar', () => ({
  default: ({ parties }: { parties: unknown[] }) => <div data-testid="radar">radar:{parties.length}</div>,
}))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    t: {
      ecosysteme: { title: 'Écosystème', subtitle: '{shown}/{total}', allEntities: 'Toutes', categories: 'Catégories', empty: 'Vide' },
      workshop: { a3: { ppTypes: { PRESTATAIRE: 'Prestataire', FOURNISSEUR: 'Fournisseur' } } },
    },
  }),
}))

const T = (id: string, type: string, orgId: string): FullTier =>
  ({ id, nom: id, type, exposition: 6, fiabilite: 3, critique: false, orgId, orgNom: orgId })

const tiers = [T('a', 'PRESTATAIRE', 'o1'), T('b', 'FOURNISSEUR', 'o1'), T('c', 'PRESTATAIRE', 'o2')]
const orgs = [{ id: 'o1', nom: 'o1', count: 2 }, { id: 'o2', nom: 'o2', count: 1 }]

describe('EcosystemFullView', () => {
  it('affiche tous les tiers puis filtre par entité (onglet)', () => {
    render(<EcosystemFullView tiers={tiers} orgs={orgs} />)
    expect(screen.getByTestId('radar').textContent).toBe('radar:3')
    fireEvent.click(screen.getByRole('button', { name: /o2/ }))
    expect(screen.getByTestId('radar').textContent).toBe('radar:1') // seul le tiers de o2
  })

  it('filtre par catégorie (désactiver un type le retire du radar)', () => {
    render(<EcosystemFullView tiers={tiers} orgs={orgs} />)
    // Désactive « Fournisseur » (1 tiers) → il reste 2 prestataires.
    fireEvent.click(screen.getByRole('button', { name: /Fournisseur/ }))
    expect(screen.getByTestId('radar').textContent).toBe('radar:2')
  })
})
