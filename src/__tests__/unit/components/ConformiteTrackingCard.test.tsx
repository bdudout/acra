// Recette n° 23 : sans droit de modification, les non-conformités se consultent (liste en lecture) sans être
// présentées « à traiter » ; avec le droit, libellé « à traiter » et statut modifiable.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ConformiteTrackingCard, { type ConformiteCardRow } from '@/components/ConformiteTrackingCard'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/ConformiteHistory', () => ({ default: () => null }))

const row = (canEdit: boolean): ConformiteCardRow => ({
  key: 'org:o1:PCI', source: 'org', orgId: 'o1', referentiel: 'PCI', nom: 'Banque', isSocle: false, frameworkNom: 'PCI-DSS v4.0.1', canEdit, total: 3,
  stats: { conforme: 1, partiel: 1, nonConforme: 1, na: 0, evalues: 3, total: 3, tauxConformite: 50 } as never,
  nonConformites: [{ ref: '1.1', nom: 'Pare-feu', statut: 'non_conforme' }, { ref: '2.1', nom: 'Mots de passe', statut: 'partiel' }],
})

describe('ConformiteTrackingCard', () => {
  it('lecture seule : « 2 non-conformité(s) » consultables, ni « à traiter » ni liste de statuts', () => {
    render(<ConformiteTrackingCard rows={[row(false)]} locale="fr" />)
    expect(screen.queryByText(/à traiter/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /2 non-conformité\(s\)/ }))
    expect(screen.getByText('Pare-feu')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
  it('modification permise : « à traiter » et statut modifiable', () => {
    render(<ConformiteTrackingCard rows={[row(true)]} locale="fr" />)
    fireEvent.click(screen.getByRole('button', { name: /2 non-conformité\(s\) à traiter/ }))
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })
})
