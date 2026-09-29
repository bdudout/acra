import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import IncidentAnalysePanel, { type AnalyseValue } from '@/components/IncidentAnalysePanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const vide: AnalyseValue = { causeRacine: '', causeDetail: '', leconsApprises: '', chronologie: [], impactsNonFinanciers: [], allocations: [] }

describe('IncidentAnalysePanel', () => {
  it('cause racine, précisions et leçons apprises', () => {
    const onChange = vi.fn()
    render(<IncidentAnalysePanel value={vide} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Cause racine'), { target: { value: 'TIERS' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...vide, causeRacine: 'TIERS' })
    fireEvent.change(screen.getByLabelText('Leçons apprises'), { target: { value: 'Revoir le contrat' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...vide, leconsApprises: 'Revoir le contrat' })
  })
  it('chronologie : ajout d’un événement daté, puis retrait', () => {
    const onChange = vi.fn()
    const { rerender } = render(<IncidentAnalysePanel value={vide} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un événement' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...vide, chronologie: [{ type: 'DETECTION', date: expect.any(String), texte: '' }] })
    const avec: AnalyseValue = { ...vide, chronologie: [{ type: 'DETECTION', date: '2026-09-01T08:00', texte: 'Alerte SIEM' }] }
    rerender(<IncidentAnalysePanel value={avec} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Description — événement 1'), { target: { value: 'Alerte SIEM confirmée' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...vide, chronologie: [{ type: 'DETECTION', date: '2026-09-01T08:00', texte: 'Alerte SIEM confirmée' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Retirer — événement 1' }))
    expect(onChange).toHaveBeenLastCalledWith(vide)
  })
  it('impacts non financiers : unité et valeur', () => {
    const onChange = vi.fn()
    render(<IncidentAnalysePanel value={{ ...vide, impactsNonFinanciers: [{ unite: 'JOURS_ARRET', valeur: 2 }] }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Valeur — impact 1'), { target: { value: '5' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...vide, impactsNonFinanciers: [{ unite: 'JOURS_ARRET', valeur: 5 }] })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un impact' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...vide, impactsNonFinanciers: [{ unite: 'JOURS_ARRET', valeur: 2 }, { unite: 'CLIENTS_TOUCHES', valeur: 0 }] })
  })
  it('allocation : le reste non alloué est indiqué et l’ajout d’une part est proposé', () => {
    const onChange = vi.fn()
    render(<IncidentAnalysePanel value={{ ...vide, allocations: [{ entite: 'Filiale Nord', pct: 60 }] }} onChange={onChange} />)
    expect(screen.getByText(/Reste non alloué : 40 %/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Part (%) — allocation 1'), { target: { value: '70' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...vide, allocations: [{ entite: 'Filiale Nord', pct: 70 }] })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une allocation' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...vide, allocations: [{ entite: 'Filiale Nord', pct: 60 }, { entite: '', pct: 0 }] })
  })
  it('lecture seule : aucun bouton d’ajout', () => {
    render(<IncidentAnalysePanel value={vide} onChange={() => {}} readOnly />)
    expect(screen.queryByRole('button', { name: 'Ajouter un événement' })).toBeNull()
  })
})
