// Libérer de l'espace : aperçu, confirmation par saisie du nombre de points, demande à l'agent.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import BackupPrunePanel from '@/components/BackupPrunePanel'
import { DEFAULT_BACKUP_POLICY } from '@/lib/backup-policy'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
const e = (id: string, size: number) => ({ id, reason: 'scheduled', createdAt: '2026-10-01T02:00:00Z', version: '1.0.4', sizeBytes: size })
const preview = { toDelete: [e('20261001T020000Z-scheduled-1.0.4', 5e8), e('20261002T020000Z-scheduled-1.0.4', 5e8)], toKeep: [e('20261003T020000Z-scheduled-1.0.4', 5e8)], reclaimedBytes: 1e9 }
const ok = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body })
const base = { policy: DEFAULT_BACKUP_POLICY, agentAvailable: true, onChanged: vi.fn() }
const bodyOf = (i: number) => JSON.parse(fetchMock.mock.calls[i][1].body)

describe('BackupPrunePanel', () => {
  it('bouton désactivé sans agent', () => {
    render(<BackupPrunePanel {...base} agentAvailable={false} />)
    expect((screen.getByRole('button', { name: 'Libérer de l’espace' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('ouverture : aperçu avec les valeurs de la politique (3+3+3 planifiés, 3 avant mise à jour, 3 manuels), manuels exclus', async () => {
    fetchMock.mockResolvedValue(ok(preview))
    render(<BackupPrunePanel {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Libérer de l’espace' }))
    await screen.findByText(/2 point\(s\) supprimé\(s\)/)
    expect(bodyOf(0)).toEqual({ keepScheduled: 9, keepPreUpdate: 3, keepManual: 3, includeManual: false })
    expect(screen.getByTestId('prune-summary').textContent).toContain('954 Mo')
    expect(screen.getAllByTestId('prune-row')).toHaveLength(2)
  })

  it('suppression : bloquée tant que le nombre saisi diffère, puis demande avec confirmCount', async () => {
    fetchMock.mockResolvedValueOnce(ok(preview)).mockResolvedValueOnce(ok({ requested: true, count: 2 }, 202))
    render(<BackupPrunePanel {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Libérer de l’espace' }))
    await screen.findByText(/2 point\(s\) supprimé\(s\)/)
    const del = screen.getByRole('button', { name: 'Supprimer ces points' }) as HTMLButtonElement
    expect(del.disabled).toBe(true)
    const input = screen.getByLabelText(/Saisissez 2/)
    fireEvent.change(input, { target: { value: '3' } }); expect(del.disabled).toBe(true)
    fireEvent.change(input, { target: { value: '2' } }); expect(del.disabled).toBe(false)
    fireEvent.click(del)
    await screen.findByText(/Suppression demandée/)
    expect(bodyOf(1)).toEqual({ keepScheduled: 9, keepPreUpdate: 3, keepManual: 3, includeManual: false, confirmCount: 2 })
    expect(base.onChanged).toHaveBeenCalled()
  })

  it('cocher « sauvegardes manuelles » relance l’aperçu avec includeManual', async () => {
    fetchMock.mockResolvedValue(ok(preview))
    render(<BackupPrunePanel {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Libérer de l’espace' }))
    await screen.findByText(/2 point\(s\) supprimé\(s\)/)
    fireEvent.click(screen.getByLabelText('Inclure les sauvegardes manuelles'))
    await waitFor(() => expect(bodyOf(fetchMock.mock.calls.length - 1).includeManual).toBe(true))
  })

  it('rien à supprimer : message et pas de bouton de suppression', async () => {
    fetchMock.mockResolvedValue(ok({ toDelete: [], toKeep: preview.toKeep, reclaimedBytes: 0 }))
    render(<BackupPrunePanel {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Libérer de l’espace' }))
    await screen.findByText('Rien à supprimer avec ces valeurs.')
    expect(screen.queryByRole('button', { name: 'Supprimer ces points' })).toBeNull()
  })

  it('erreur update_in_progress : message traduit', async () => {
    fetchMock.mockResolvedValue(ok({ error: 'update_in_progress' }, 409))
    render(<BackupPrunePanel {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Libérer de l’espace' }))
    await screen.findByText(/mise à jour est en cours/)
  })
})
