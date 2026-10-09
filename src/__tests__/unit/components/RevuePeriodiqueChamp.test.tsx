// Champ « dernière revue » partagé (traitements, processus, tiers) : saisie d'une date passée et prochaine échéance
// affichée (12 mois après la dernière revue, ou après la création si l'objet n'a jamais été revu) ; retard signalé.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RevuePeriodiqueChamp from '@/components/RevuePeriodiqueChamp'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const now = new Date('2026-10-09T12:00:00Z')

describe('RevuePeriodiqueChamp', () => {
  it('prochaine revue 12 mois après la dernière ; saisie transmise', () => {
    const onChange = vi.fn()
    render(<RevuePeriodiqueChamp valeur="2026-03-01" creeLe="2020-01-01T00:00:00Z" onChange={onChange} now={now} />)
    expect(screen.getByText(/Prochaine revue : 01\/03\/2027/)).toBeInTheDocument()
    expect(screen.queryByText('Revue en retard')).toBeNull()
    fireEvent.change(screen.getByLabelText('Dernière revue'), { target: { value: '2026-10-01' } })
    expect(onChange).toHaveBeenCalledWith('2026-10-01')
    expect(screen.getByLabelText('Dernière revue')).toHaveAttribute('max', '2026-10-09')
  })
  it('jamais revu, créé il y a plus d’un an : échéance après la création, retard signalé', () => {
    render(<RevuePeriodiqueChamp valeur="" creeLe="2025-05-02T00:00:00Z" onChange={() => {}} now={now} />)
    expect(screen.getByText(/Prochaine revue : 02\/05\/2026/)).toBeInTheDocument()
    expect(screen.getByText('Revue en retard')).toBeInTheDocument()
  })
  it('création (pas encore de date de création) : pas d’échéance affichée', () => {
    render(<RevuePeriodiqueChamp valeur="" onChange={() => {}} now={now} />)
    expect(screen.queryByText(/Prochaine revue/)).toBeNull()
  })
})
