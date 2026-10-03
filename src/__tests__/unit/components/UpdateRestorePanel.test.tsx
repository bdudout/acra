// Lot 4 — avancement de la mise à jour, résultat (dont retour arrière automatique) et points de restauration.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import UpdateRestorePanel from '@/components/UpdateRestorePanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
const snap = { id: '20261003T101500Z-pre-update-1.0.4', reason: 'pre-update' as const, createdAt: '2026-10-03T10:15:00Z', version: '1.0.4', toVersion: '1.0.5', verified: 'full' as const, clone: true, documents: true, encrypted: false, sizeBytes: 23456789 }
const base = { status: null, run: null, snapshots: [snap], agentAvailable: true, onChanged: vi.fn() }

describe('UpdateRestorePanel', () => {
  it('affiche l’avancement : étapes traduites, étape courante signalée', () => {
    render(<UpdateRestorePanel {...base} status={{ state: 'RUNNING', step: 'MIGRATE', steps: [{ step: 'PRECHECK', ok: true, at: 'x' }, { step: 'SNAPSHOT', ok: true, at: 'x' }] }} />)
    expect(screen.getByText('Avancement de la mise à jour')).toBeTruthy()
    expect(screen.getByText('Point de restauration', { selector: 'li *, li' })).toBeTruthy()
    expect(screen.getByText('Migration de la base').closest('li')?.getAttribute('aria-current')).toBe('step')
  })

  it('échec avec retour arrière automatique : message rassurant avec versions et étape', () => {
    render(<UpdateRestorePanel {...base} status={{ state: 'FAILED', step: 'ROLLED_BACK', code: 'migrate_failed', from: '1.0.4', to: '1.0.5', rolledBack: true }} />)
    expect(screen.getByRole('status').textContent).toContain('La mise à jour vers 1.0.5 a échoué')
    expect(screen.getByRole('status').textContent).toContain('ACRA 1.0.4 a été restauré automatiquement, aucune donnée perdue')
    expect(screen.getByRole('status').textContent).toContain('Migration de la base en échec')
  })

  it('échec du retour arrière : alerte et renvoi au runbook', () => {
    render(<UpdateRestorePanel {...base} status={{ state: 'FAILED', code: 'rollback_failed', from: '1.0.4', to: '1.0.5' }} />)
    expect(screen.getByRole('alert').textContent).toContain('application est arrêtée')
    expect(screen.getByRole('alert').textContent).toContain('runbook-exploitation.md § 6')
  })

  it('liste les points de restauration (version, vérification, clone, documents)', () => {
    render(<UpdateRestorePanel {...base} />)
    const row = screen.getByText('1.0.4').closest('tr')!
    expect(row.textContent).toContain('complète')
    expect(screen.getByRole('button', { name: 'Revenir à ce point' })).toBeTruthy()
  })

  it('sans point : message explicatif ; sans agent : pas de bouton', () => {
    const { rerender } = render(<UpdateRestorePanel {...base} snapshots={[]} />)
    expect(screen.getByText(/Aucun point de restauration pour le moment/)).toBeTruthy()
    rerender(<UpdateRestorePanel {...base} agentAvailable={false} />)
    expect(screen.queryByRole('button', { name: 'Revenir à ce point' })).toBeNull()
  })

  it('dialogue : bouton désactivé tant que la version n’est pas saisie ; envoie la demande', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ requested: true }) } as Response)
    const onChanged = vi.fn()
    render(<UpdateRestorePanel {...base} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: 'Revenir à ce point' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('ACRA 1.0.4 sera restauré')
    expect(dialog.textContent).toContain('saisies faites après ce point seront perdues')
    expect(dialog.textContent).toContain('conservée 14 jours')
    expect(dialog.textContent).toContain('clé de chiffrement des secrets')
    const confirm = screen.getByRole('button', { name: 'Restaurer ce point' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Saisissez le numéro de version 1\.0\.4/), { target: { value: '1.0.5' } })
    expect(confirm.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Saisissez le numéro de version 1\.0\.4/), { target: { value: '1.0.4' } })
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/version/rollback')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ snapshotId: snap.id, confirmVersion: '1.0.4' })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('dialogue : chiffre les saisies perdues et la durée de conservation fournies par le serveur', () => {
    render(<UpdateRestorePanel {...base} impacts={{ [snap.id]: { auditEntries: 12, documents: 3 } }} retentionDays={30} />)
    fireEvent.click(screen.getByRole('button', { name: 'Revenir à ce point' }))
    expect(screen.getByTestId('restore-impact').textContent).toContain('12 entrée(s) du journal d’audit et 3 document(s)')
    expect(screen.getByRole('dialog').textContent).toContain('conservée 30 jours')
  })

  it('sauvegarde externe : absente ⇒ explication ; à jour ⇒ pilote et âge ; en échec ⇒ alerte', () => {
    const { rerender } = render(<UpdateRestorePanel {...base} offsite={null} />)
    expect(screen.getByText(/Aucune sauvegarde externe configurée/)).toBeTruthy()
    const recent = new Date(Date.now() - 3 * 3600_000).toISOString()
    rerender(<UpdateRestorePanel {...base} offsite={{ driver: 's3', lastSnapshotId: snap.id, lastSuccessAt: recent, lastFailureAt: null, lastCode: 0 }} />)
    expect(screen.getByTestId('offsite-status').textContent).toContain('À jour — Stockage objet S3 — dernier envoi il y a 3 h')
    rerender(<UpdateRestorePanel {...base} offsite={{ driver: 'fs', lastSnapshotId: snap.id, lastSuccessAt: recent, lastFailureAt: new Date().toISOString(), lastCode: 51 }} />)
    expect(screen.getByRole('alert').textContent).toContain('En échec')
    rerender(<UpdateRestorePanel {...base} offsiteMaxAgeHours={1} offsite={{ driver: 'fs', lastSnapshotId: snap.id, lastSuccessAt: recent, lastFailureAt: null, lastCode: 0 }} />)
    expect(screen.getByRole('alert').textContent).toContain('En retard')
  })

  it('signale les migrations destructives en attente (PRECHECK)', () => {
    render(<UpdateRestorePanel {...base} status={{ state: 'RUNNING', precheck: { destructive: ['20261004000000_drop_x'] } }} />)
    expect(screen.getByRole('note').textContent).toContain('1 migration(s) destructive(s)')
  })

  it('annuler ferme le dialogue sans appel réseau ; mise à jour en cours : pas de bouton de retour', () => {
    const { rerender } = render(<UpdateRestorePanel {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Revenir à ce point' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull(); expect(fetchMock).not.toHaveBeenCalled()
    rerender(<UpdateRestorePanel {...base} status={{ state: 'RUNNING' }} />)
    expect(screen.queryByRole('button', { name: 'Revenir à ce point' })).toBeNull()
  })

  it('affiche l’erreur de la route', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'agent_unavailable' }) } as Response)
    render(<UpdateRestorePanel {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Revenir à ce point' }))
    fireEvent.change(screen.getByLabelText(/Saisissez le numéro de version/), { target: { value: '1.0.4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Restaurer ce point' }))
    expect(await screen.findByText(/Demande impossible \(agent_unavailable\)/)).toBeTruthy()
  })
})
