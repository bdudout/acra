/**
 * AtelierGuidancePanel.test.tsx — panneau de conseils par atelier.
 *  - Rendu des participants / conseils / liens selon l'atelier
 *  - num invalide → null
 *  - Masquage persisté en localStorage
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AtelierGuidancePanel from '@/components/AtelierGuidancePanel'

beforeEach(() => {
  localStorage.clear()
})

describe('AtelierGuidancePanel', () => {
  it('affiche participants, conseils et liens pour un atelier donné (fr par défaut)', () => {
    render(<AtelierGuidancePanel num={1} />)
    expect(screen.getByText(/Participants recommandés/)).toBeInTheDocument()
    expect(screen.getByText('RSSI')).toBeInTheDocument()
    expect(screen.getByText('DSI / Architectes')).toBeInTheDocument()
    expect(screen.getByText(/Conseils essentiels/)).toBeInTheDocument()
    // lien externe ANSSI présent
    const anssi = screen.getByText(/Guide ANSSI/i).closest('a')
    expect(anssi).toHaveAttribute('href', expect.stringContaining('cyber.gouv.fr'))
    expect(anssi).toHaveAttribute('target', '_blank')
  })

  it('propose des participants différents selon l\'atelier', () => {
    const { rerender } = render(<AtelierGuidancePanel num={4} />)
    expect(screen.getByText('Pentesters')).toBeInTheDocument()
    rerender(<AtelierGuidancePanel num={5} />)
    expect(screen.getByText(/arbitrage/i)).toBeInTheDocument()
  })

  it('rend null pour un numéro d\'atelier inconnu', () => {
    const { container } = render(<AtelierGuidancePanel num={9} />)
    expect(container.firstChild).toBeNull()
  })

  it('se masque au clic et persiste l\'état en localStorage', () => {
    render(<AtelierGuidancePanel num={1} />)
    fireEvent.click(screen.getByText('Masquer'))
    expect(localStorage.getItem('acra-guidance-collapsed')).toBe('1')
    // le bouton de réaffichage (aria-label) est présent, le titre de section ne l'est plus
    expect(screen.getByLabelText(/Afficher les conseils/i)).toBeInTheDocument()
    expect(screen.queryByText('Participants recommandés')).not.toBeInTheDocument()
  })

  it('démarre masqué si localStorage le demande', () => {
    localStorage.setItem('acra-guidance-collapsed', '1')
    render(<AtelierGuidancePanel num={2} />)
    expect(screen.queryByText('Participants recommandés')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Afficher les conseils/i)).toBeInTheDocument()
  })
})
