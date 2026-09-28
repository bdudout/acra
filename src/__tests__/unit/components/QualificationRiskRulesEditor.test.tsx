import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import QualificationRiskRulesEditor from '@/components/QualificationRiskRulesEditor'
import type { QualificationRiskRule } from '@/lib/qualification'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const questions = [
  { id: 'donneesPersonnelles', label: 'Données personnelles ?', type: 'bool' as const },
  { id: 'criticite', label: 'Criticité', type: 'choice' as const, options: [{ value: 'faible', label: 'Faible' }, { value: 'eleve', label: 'Élevée' }] },
]
const catalogRule: QualificationRiskRule = { id: 'cyber-personal-data', when: { questionId: 'donneesPersonnelles', equals: true }, risk: { category: 'CYBER', title: '', titleKey: 'personalData', gravity: 4, likelihood: 2, strategy: 'REDUIRE' } }

describe('QualificationRiskRulesEditor', () => {
  it('rend l’intitulé traduit d’une règle du catalogue en placeholder', () => {
    render(<QualificationRiskRulesEditor rules={[catalogRule]} questions={questions} onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('Violation de données à caractère personnel')).toBeTruthy()
  })

  it('rend une règle imposée', () => {
    const onChange = vi.fn()
    render(<QualificationRiskRulesEditor rules={[catalogRule]} questions={questions} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Imposé (non décochable)'))
    expect(onChange.mock.calls[0][0][0].mandatory).toBe(true)
  })

  it('choisir une question à choix réinitialise la réponse sur sa 1ʳᵉ option', () => {
    const onChange = vi.fn()
    render(<QualificationRiskRulesEditor rules={[catalogRule]} questions={questions} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'criticite' } })
    expect(onChange.mock.calls[0][0][0].when).toEqual({ questionId: 'criticite', equals: 'faible' })
  })

  it('ajoute puis supprime une règle', () => {
    const onChange = vi.fn()
    const { rerender } = render(<QualificationRiskRulesEditor rules={[]} questions={questions} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une règle/ }))
    const added = onChange.mock.calls[0][0] as QualificationRiskRule[]
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({ when: { questionId: 'donneesPersonnelles', equals: true }, mandatory: false, enabled: true })
    rerender(<QualificationRiskRulesEditor rules={added} questions={questions} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la règle' }))
    expect(onChange.mock.calls[1][0]).toEqual([])
  })
})
