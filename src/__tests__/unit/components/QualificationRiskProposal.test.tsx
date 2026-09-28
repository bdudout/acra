import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import QualificationRiskProposal from '@/components/QualificationRiskProposal'

const labels = {
  title: 'Risques proposés', explanation: 'Sélectionnez.', confirm: 'Importer', cancel: 'Plus tard',
  gravity: 'Gravité', likelihood: 'Vraisemblance', strategy: 'Traitement', mandatory: 'Imposé',
  mandatoryHint: 'Risque imposé : il sera créé.', categories: { CYBER: 'Cyber', PROJECT: 'Projet', OPERATIONAL: 'Opérationnel', FRAUD: 'Fraude' },
}
const strategies = { REDUIRE: 'Réduire', ACCEPTER: 'Accepter', TRANSFERER: 'Transférer', REFUSER: 'Refuser', SURVEILLER: 'Surveiller' }
const risks = [
  { id: 'r1', category: 'CYBER' as const, title: 'Fuite de données', gravity: 4, likelihood: 2, strategy: 'REDUIRE' as const, mandatory: false },
  { id: 'r2', category: 'FRAUD' as const, title: 'Fraude', gravity: 3, likelihood: 2, strategy: 'REDUIRE' as const, mandatory: false },
  { id: 'r3', category: 'CYBER' as const, title: 'Rançongiciel', gravity: 4, likelihood: 3, strategy: 'REDUIRE' as const, mandatory: true },
]

describe('QualificationRiskProposal', () => {
  it('laisse décocher les risques proposés avant leur import', () => {
    const onConfirm = vi.fn()
    render(<QualificationRiskProposal labels={labels} strategies={strategies} risks={risks} onCancel={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByLabelText('Fraude'))
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))
    expect(onConfirm).toHaveBeenCalledWith(['r1', 'r3'])
  })

  it('un risque imposé est coché, verrouillé et signalé', () => {
    const onConfirm = vi.fn()
    render(<QualificationRiskProposal labels={labels} strategies={strategies} risks={risks} onCancel={vi.fn()} onConfirm={onConfirm} />)
    const box = screen.getByLabelText('Rançongiciel') as HTMLInputElement
    expect(box.checked).toBe(true)
    expect(box.disabled).toBe(true)
    fireEvent.click(box)
    expect(screen.getByText('Imposé')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))
    expect(onConfirm).toHaveBeenCalledWith(['r1', 'r2', 'r3'])
  })

  it('affiche catégorie et traitement traduits', () => {
    render(<QualificationRiskProposal labels={labels} strategies={strategies} risks={[risks[1]]} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText(/Fraude · Gravité 3\/4 · Vraisemblance 2\/4 · Traitement Réduire/)).toBeTruthy()
  })
})
