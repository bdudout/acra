import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import QualificationQuestions from '@/components/QualificationQuestions'

describe('QualificationQuestions', () => {
  it('expose les réponses de qualification avant la création et remonte le choix', () => {
    const onChange = vi.fn()
    render(<QualificationQuestions answers={{}} onChange={onChange} labels={{
      questions: { externalisation: 'Externalisation critique', criticite: 'Criticité' },
      criticiteOptions: { faible: 'Faible', modere: 'Modéré', eleve: 'Élevé' },
      statutOptions: {}, yes: 'Oui', no: 'Non',
    }} config={{ overrides: { donneesPersonnelles: { enabled: false } }, custom: [] }} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Oui' })[0])
    expect(onChange).toHaveBeenCalledWith({ externalisation: true })
    expect(screen.queryByText(/données personnelles/i)).not.toBeInTheDocument()
  })
})
