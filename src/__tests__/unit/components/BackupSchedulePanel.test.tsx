// Planification des sauvegardes : fréquences, conservation, estimation d'espace et avertissements.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import BackupSchedulePanel from '@/components/BackupSchedulePanel'
import { DEFAULT_BACKUP_POLICY, GB, parseBackupStats } from '@/lib/backup-policy'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
const stats = (o: object = {}) => parseBackupStats({ schema: 1, at: '2026-10-04T03:00:00Z', freeBytes: 100 * GB, backupsBytes: 2 * GB, points: 3, scheduledPoints: 3, lastScheduledPointBytes: GB, lastPreUpdatePointBytes: GB, dbBytes: 2 * GB, lastRunAt: '2026-10-04T02:00:05Z', lastCode: 0, lastTiers: 'daily,weekly', ...o })
const base = { policy: DEFAULT_BACKUP_POLICY, stats: stats(), agentAvailable: true, offsiteConfigured: true, onChanged: vi.fn() }
const keepInput = (name: RegExp) => screen.getByLabelText(name) as HTMLInputElement

describe('BackupSchedulePanel', () => {
  it('affiche les défauts : trois fréquences actives, 3 copies chacune', () => {
    render(<BackupSchedulePanel {...base} />)
    for (const f of ['Quotidienne', 'Hebdomadaire', 'Mensuelle']) expect((screen.getByRole('checkbox', { name: f }) as HTMLInputElement).checked).toBe(true)
    expect(keepInput(/Quotidienne — copies conservées/).value).toBe('3')
    expect(keepInput(/Hebdomadaire — copies conservées/).value).toBe('3')
    expect(keepInput(/Mensuelle — copies conservées/).value).toBe('3')
  })

  it('estimation : 9 sauvegardes au plus et espace nécessaire ; libre et occupé affichés', () => {
    render(<BackupSchedulePanel {...base} />)
    const est = screen.getByTestId('estimate').textContent!
    expect(est).toContain('9 sauvegardes planifiées au plus')
    expect(est).toContain('18 Go')
    expect(screen.getByTestId('free-line').textContent).toContain('100 Go')
    expect(screen.getByTestId('free-line').textContent).toContain('2 Go')
    expect(screen.getByTestId('verdict').textContent).toContain('suffisant')
  })

  it('augmenter la conservation augmente l’estimation et peut dégrader le verdict', () => {
    render(<BackupSchedulePanel {...base} stats={stats({ freeBytes: 20 * GB })} />)
    expect(screen.getByTestId('verdict').textContent).toContain('Marge faible')
    fireEvent.change(keepInput(/Quotidienne — copies conservées/), { target: { value: '30' } })
    expect(screen.getByTestId('estimate').textContent).toContain('36 sauvegardes planifiées au plus')
    expect(screen.getByRole('alert').textContent).toContain('Espace insuffisant')
  })

  it('conseils de bonnes pratiques : conservation inférieure à 7 / 4 / 6, et usage courant rappelé', () => {
    render(<BackupSchedulePanel {...base} />)
    const t = screen.getByTestId('advice').textContent!
    expect(t).toContain('Moins de 7 copies quotidiennes'); expect(t).toContain('Moins de 4 copies hebdomadaires'); expect(t).toContain('Moins de 6 copies mensuelles')
    expect(t).toContain('7 quotidiennes, 4 hebdomadaires, 6 mensuelles')
    fireEvent.change(keepInput(/Quotidienne — copies conservées/), { target: { value: '7' } })
    fireEvent.change(keepInput(/Hebdomadaire — copies conservées/), { target: { value: '4' } })
    fireEvent.change(keepInput(/Mensuelle — copies conservées/), { target: { value: '6' } })
    expect(screen.queryByTestId('advice')).toBeNull()
  })

  it('sans mesures de l’agent : verdict d’espace inconnu', () => {
    render(<BackupSchedulePanel {...base} stats={null} />)
    expect(screen.getByTestId('verdict').textContent).toContain('Espace libre inconnu')
  })

  it('enregistrer envoie la politique ; désactivé si aucune fréquence, sans modification, ou sans agent', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ requested: true }) } as Response)
    const onChanged = vi.fn()
    const { rerender } = render(<BackupSchedulePanel {...base} onChanged={onChanged} />)
    const save = screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(keepInput(/Quotidienne — copies conservées/), { target: { value: '7' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/backup/policy')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).policy.daily).toEqual({ enabled: true, keep: 7 })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    for (const f of ['Quotidienne', 'Hebdomadaire', 'Mensuelle']) fireEvent.click(screen.getByRole('checkbox', { name: f }))
    expect((screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Activez au moins une fréquence.')).toBeTruthy()
    rerender(<BackupSchedulePanel {...base} agentAvailable={false} />)
    expect(screen.getByText(/L’agent de mise à jour doit être installé/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('erreur de la route affichée ; 409 « demande en attente » expliquée', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'request_pending' }) } as Response)
    render(<BackupSchedulePanel {...base} />)
    fireEvent.change(keepInput(/Quotidienne — copies conservées/), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText(/Une demande attend déjà l’agent/)).toBeTruthy()
  })

  it('dernier passage : succès daté, ou échec avec code ; aucune sauvegarde pour l’instant', () => {
    const { rerender } = render(<BackupSchedulePanel {...base} />)
    expect(screen.getByTestId('last-run').textContent).toContain('Dernière sauvegarde planifiée')
    rerender(<BackupSchedulePanel {...base} stats={stats({ lastCode: 20 })} />)
    expect(screen.getByTestId('last-run').textContent).toContain('code 20')
    rerender(<BackupSchedulePanel {...base} stats={stats({ lastRunAt: null, lastCode: null, lastTiers: '' })} />)
    expect(screen.getByTestId('last-run').textContent).toContain('Aucune sauvegarde planifiée')
  })

  it('rappelle de configurer la sauvegarde externe si elle ne l’est pas', () => {
    const { rerender } = render(<BackupSchedulePanel {...base} offsiteConfigured={false} />)
    expect(screen.getByText(/ne protègent pas de sa perte/)).toBeTruthy()
    rerender(<BackupSchedulePanel {...base} offsiteConfigured />)
    expect(screen.queryByText(/ne protègent pas de sa perte/)).toBeNull()
  })

  it('prochaines exécutions affichées pour les fréquences actives', () => {
    render(<BackupSchedulePanel {...base} />)
    expect(screen.getByTestId('next-runs').textContent).toMatch(/Quotidienne[\s\S]*Hebdomadaire[\s\S]*Mensuelle/)
  })
})
