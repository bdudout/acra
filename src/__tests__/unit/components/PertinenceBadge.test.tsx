import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PertinenceBadge from '@/components/workshops/PertinenceBadge'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

describe('PertinenceBadge', () => {
  it('cas d’usage', () => {
    render(<PertinenceBadge ex={{ pertinence: 'CAS_USAGE' }} />)
    expect(screen.getByText("Pertinent pour votre cas d'usage")).toBeInTheDocument()
  })
  it('architecture : nomme les patterns concernés', () => {
    render(<PertinenceBadge ex={{ pertinence: 'ARCHITECTURE', patternsPertinents: ['TELEMAINTENANCE', 'SI_INDUSTRIEL'] }} />)
    expect(screen.getByText(/Pertinent pour votre architecture : Télémaintenance, /)).toBeInTheDocument()
  })
  it('secteur (classement par mots-clés, ou ancien drapeau `pertinent`)', () => {
    render(<PertinenceBadge ex={{ pertinent: true }} />)
    expect(screen.getByText('Pertinent pour votre secteur')).toBeInTheDocument()
  })
  it('rien sinon', () => {
    const { container } = render(<PertinenceBadge ex={{}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
