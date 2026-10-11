// Recette n° 11 : sur /configuration/entites, le guide « Petite structure » est replié par défaut (titre + état visibles),
// pour ne pas occuper un écran entier avant « Entités & rôles ».
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PetiteStructureGuide from '@/components/PetiteStructureGuide'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ petiteStructure: true }) }))) })

describe('PetiteStructureGuide', () => {
  it('replié par défaut : titre et état visibles ; le détail s’ouvre au clic', async () => {
    const { fr } = await import('@/lib/i18n/fr')
    render(<PetiteStructureGuide />)
    const bouton = screen.getByRole('button', { name: new RegExp(fr.admin.petiteStructure.titre) })
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(fr.admin.petiteStructure.intro)).toBeNull()
    expect(await screen.findByText(fr.admin.petiteStructure.actif)).toBeInTheDocument()
    fireEvent.click(bouton)
    expect(screen.getByText(fr.admin.petiteStructure.intro)).toBeInTheDocument()
  })
})
