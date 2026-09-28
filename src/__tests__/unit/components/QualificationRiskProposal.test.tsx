import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import QualificationRiskProposal from '@/components/QualificationRiskProposal'

describe('QualificationRiskProposal', () => {
  it('laisse choisir les risques proposés avant leur import', () => {
    const onConfirm = vi.fn()
    render(<QualificationRiskProposal labels={{ title: 'Risques proposés', explanation: 'Sélectionnez.', confirm: 'Importer', cancel: 'Plus tard', gravity: 'Gravité', likelihood: 'Vraisemblance', strategy: 'Traitement' }} risks={[{ id: 'r1', category: 'CYBER', title: 'Fuite de données', gravity: 4, likelihood: 2, strategy: 'REDUIRE' }, { id: 'r2', category: 'FRAUD', title: 'Fraude', gravity: 3, likelihood: 2, strategy: 'REDUIRE' }]} onCancel={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByLabelText('Fraude'))
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))
    expect(onConfirm).toHaveBeenCalledWith(['r1'])
  })
})
