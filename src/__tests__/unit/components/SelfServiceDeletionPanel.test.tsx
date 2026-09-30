import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SelfServiceDeletionPanel from '@/components/SelfServiceDeletionPanel'

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock('next-auth/react', () => ({ signOut }))

const labels = { title: 'Supprimer mon compte de démonstration', description: 'Suppression définitive.', confirmation: 'Je confirme.', button: 'Supprimer définitivement', error: 'Indisponible.', password: 'Mot de passe actuel' }

describe('SelfServiceDeletionPanel', () => {
  it('reste absent lorsque la politique de démo le désactive', () => {
    render(<SelfServiceDeletionPanel enabled={false} labels={labels} />)
    expect(screen.queryByText(labels.title)).not.toBeInTheDocument()
  })

  it('demande une confirmation avant de supprimer puis ferme la session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const user = userEvent.setup()
    render(<SelfServiceDeletionPanel enabled labels={labels} />)
    const button = screen.getByRole('button', { name: labels.button })
    expect(button).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: labels.confirmation }))
    expect(button).toBeDisabled() // le mot de passe courant est requis (N05)
    await user.type(screen.getByLabelText(labels.password), 'Secret-123!')
    await user.click(button)
    expect(fetch).toHaveBeenCalledWith('/api/account/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'Secret-123!' }) })
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' })
  })
})
