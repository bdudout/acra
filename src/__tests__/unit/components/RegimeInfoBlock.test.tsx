import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RegimeInfoBlock from '@/components/RegimeInfoBlock'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

describe('RegimeInfoBlock', () => {
  it('fiche repliée par défaut ; ouverte : base légale, destinataire, déclencheur, délais, canal, sources et avertissement', () => {
    render(<RegimeInfoBlock code="DORA" />)
    const summary = screen.getByText(/Informations sur ce régime/)
    expect(summary.closest('details')).not.toHaveAttribute('open')
    fireEvent.click(summary)
    for (const t of ['Base légale', 'Destinataire', 'Déclencheur', 'Délais', 'Canal de dépôt', 'À noter', 'Sources']) expect(screen.getByText(t)).toBeInTheDocument()
    expect(screen.getByText(/un mois après le rapport intermédiaire/)).toBeInTheDocument(); expect(screen.getByText(/OneGate/)).toBeInTheDocument()
    expect(screen.getByText(/pas un avis juridique/)).toBeInTheDocument()
    expect(screen.getAllByRole('link').every(a => a.getAttribute('href')!.startsWith('https://') && a.getAttribute('rel')!.includes('noopener'))).toBe(true)
  })
  it('régime personnalisé : rien n’est affiché (aucune fiche inventée)', () => {
    const { container } = render(<RegimeInfoBlock code="MON_REGIME" />)
    expect(container).toBeEmptyDOMElement()
  })
})
