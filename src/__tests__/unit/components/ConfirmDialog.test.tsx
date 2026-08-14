/**
 * ConfirmDialog.test.tsx — boîte de confirmation accessible.
 *
 * Couvre le comportement de base ET la confirmation PAR SAISIE (`requireText`) :
 * pour une action très destructrice (purge des organisations démo), le bouton de
 * confirmation reste désactivé tant que l'opérateur n'a pas tapé le mot exact.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmDialog from '@/components/ConfirmDialog'

describe('ConfirmDialog — comportement de base', () => {
  it('déclenche onConfirm au clic sur le bouton de confirmation', () => {
    const onConfirm = vi.fn(); const onCancel = vi.fn()
    render(<ConfirmDialog message="Supprimer ?" confirmLabel="Supprimer" onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('déclenche onCancel au clic sur Annuler', () => {
    const onConfirm = vi.fn(); const onCancel = vi.fn()
    render(<ConfirmDialog message="Supprimer ?" onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})

describe('ConfirmDialog — confirmation par saisie (requireText)', () => {
  it('garde la confirmation désactivée tant que le mot exact n’est pas saisi', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        message="Purger ?" confirmLabel="Purger"
        requireText="PURGER" requireTextLabel="Tapez PURGER pour confirmer"
        onConfirm={onConfirm} onCancel={vi.fn()}
      />,
    )
    const confirm = screen.getByRole('button', { name: 'Purger' })
    const input = screen.getByLabelText('Tapez PURGER pour confirmer')

    expect(confirm).toBeDisabled()

    fireEvent.change(input, { target: { value: 'PURG' } })
    expect(confirm).toBeDisabled()

    fireEvent.change(input, { target: { value: 'PURGER' } })
    expect(confirm).toBeEnabled()

    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('ne déclenche pas onConfirm si la saisie est incorrecte', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        message="Purger ?" confirmLabel="Purger"
        requireText="PURGER" requireTextLabel="Tapez PURGER pour confirmer"
        onConfirm={onConfirm} onCancel={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Tapez PURGER pour confirmer'), { target: { value: 'purger' } })
    fireEvent.click(screen.getByRole('button', { name: 'Purger' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
