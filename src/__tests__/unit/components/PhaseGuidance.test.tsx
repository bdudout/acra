import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PhaseGuidance from '@/components/PhaseGuidance'

const base = {
  intro: 'On établit le périmètre avant d’apprécier les risques.',
  points: ['Définir le périmètre', 'Fixer les critères'],
  title: 'À propos de cette phase',
  hideLabel: 'Masquer',
  showLabel: 'À propos de cette phase',
}

beforeEach(() => { try { localStorage.clear() } catch { /* mode privé */ } })

describe('PhaseGuidance', () => {
  it('affiche le titre, l’intro et les points', () => {
    render(<PhaseGuidance {...base} />)
    expect(screen.getByText('À propos de cette phase')).toBeInTheDocument()
    expect(screen.getByText(/On établit le périmètre/)).toBeInTheDocument()
    expect(screen.getByText('Définir le périmètre')).toBeInTheDocument()
    expect(screen.getByText('Fixer les critères')).toBeInTheDocument()
  })

  it('se replie au clic sur « Masquer » puis se ré-affiche', () => {
    render(<PhaseGuidance {...base} />)
    fireEvent.click(screen.getByText('Masquer'))
    // Replié : l’intro n’est plus visible, mais le bouton de réouverture l’est.
    expect(screen.queryByText(/On établit le périmètre/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'À propos de cette phase' }))
    expect(screen.getByText(/On établit le périmètre/)).toBeInTheDocument()
  })

  it('mémorise l’état replié dans localStorage (partagé entre phases)', () => {
    const { unmount } = render(<PhaseGuidance {...base} />)
    fireEvent.click(screen.getByText('Masquer'))
    expect(localStorage.getItem('acra-phase-guidance-collapsed')).toBe('1')
    unmount()
    // Un nouveau montage lit l’état persisté → reste replié.
    render(<PhaseGuidance {...base} />)
    expect(screen.queryByText(/On établit le périmètre/)).toBeNull()
  })

  it('sans intro ni points : ne rend rien', () => {
    const { container } = render(<PhaseGuidance title="T" hideLabel="M" showLabel="S" />)
    expect(container).toBeEmptyDOMElement()
  })
})
