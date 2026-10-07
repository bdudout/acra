import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SectorMeasuresPanel from '@/components/workshops/SectorMeasuresPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const items = [
  { nom: 'Double facteur pour les patients', description: 'Application ou code à usage unique', type: 'TECHNIQUE', categorieEbios: 'PROTECTION', prioriteDefaut: 1, references: ['ISO/IEC 27001:2022, annexe A, mesure 8.5'] },
  { nom: 'Mode dégradé du portail', description: 'Rendez-vous par téléphone', type: 'ORGANISATIONNELLE', categorieEbios: 'RESILIENCE', prioriteDefaut: 3 },
]

describe('SectorMeasuresPanel (atelier 5 : mesures proposées pour le secteur)', () => {
  it('n’affiche rien sans mesure sectorielle', () => {
    const { container } = render(<SectorMeasuresPanel items={[]} existingNames={[]} onAdd={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('liste les mesures avec priorité, catégorie EBIOS et références, et ajoute la mesure choisie', () => {
    const onAdd = vi.fn()
    render(<SectorMeasuresPanel items={items} existingNames={[]} onAdd={onAdd} />)
    expect(screen.getByText('Double facteur pour les patients')).toBeInTheDocument()
    expect(screen.getByText(/ISO\/IEC 27001:2022, annexe A, mesure 8\.5/)).toBeInTheDocument()
    expect(screen.getAllByText(/P1|P3/).length).toBeGreaterThanOrEqual(2)
    fireEvent.click(screen.getAllByRole('button', { name: /Ajouter/ })[0])
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ nom: 'Double facteur pour les patients', categorieEbios: 'PROTECTION', prioriteDefaut: 1 }))
  })
  it('marque comme ajoutée une mesure déjà présente au plan (même intitulé, casse ignorée)', () => {
    render(<SectorMeasuresPanel items={items} existingNames={['mode dégradé du portail']} onAdd={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /Ajouter/ })).toHaveLength(1)
    expect(screen.getByText(/Ajoutée/)).toBeInTheDocument()
  })
})
