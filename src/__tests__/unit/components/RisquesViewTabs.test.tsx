import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RisquesViewTabs from '@/components/RisquesViewTabs'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

describe('RisquesViewTabs', () => {
  it('propose Liste et Cartographie vers le registre et la carte, et marque la vue courante', () => {
    render(<RisquesViewTabs current="carte" />)
    const liste = screen.getByRole('link', { name: 'Liste' })
    const carte = screen.getByRole('link', { name: 'Cartographie' })
    expect(liste.getAttribute('href')).toBe('/registre')
    expect(carte.getAttribute('href')).toBe('/cartographie')
    expect(carte.getAttribute('aria-current')).toBe('page')
    expect(liste.getAttribute('aria-current')).toBeNull()
  })
})
