import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReassignAnalysesDialog from '@/components/ReassignAnalysesDialog'

const labels = { title: 'Réattribuer', message: 'x possède 2 analyses', toLabel: 'Nouveau propriétaire', choose: 'Choisir…', noCandidate: 'Aucun compte', confirm: 'Réattribuer et supprimer', cancel: 'Annuler' }

describe('ReassignAnalysesDialog (T2)', () => {
  it('exige un destinataire avant de confirmer, puis le transmet', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<ReassignAnalysesDialog candidates={[{ id: 'u2', label: 'Bob' }]} labels={labels} onConfirm={onConfirm} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: /Réattribuer/ })).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: labels.confirm })
    expect(confirm).toBeDisabled()
    await user.selectOptions(screen.getByLabelText(labels.toLabel), 'u2')
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('u2')
  })

  it('sans candidat : explique qu\'il faut désactiver le compte, confirmation impossible', () => {
    render(<ReassignAnalysesDialog candidates={[]} labels={labels} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent(labels.noCandidate)
    expect(screen.getByRole('button', { name: labels.confirm })).toBeDisabled()
  })

  it('Échap ferme la fenêtre', async () => {
    const onCancel = vi.fn()
    render(<ReassignAnalysesDialog candidates={[]} labels={labels} onConfirm={vi.fn()} onCancel={onCancel} />)
    await userEvent.setup().keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })
})
