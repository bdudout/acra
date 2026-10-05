import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import BackupManagementPanel from '@/components/BackupManagementPanel'

vi.mock('@/components/BackupSchedulePanel', () => ({ default: () => <div>Planification des sauvegardes</div> }))
vi.mock('@/components/BackupPrunePanel', () => ({ default: () => <div>Purge des sauvegardes</div> }))
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('gestion des sauvegardes', () => {
  it('charge la politique existante et garde planification et purge dans le nouvel onglet', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ agentAvailable: true, offsite: null, backup: { policy: {}, stats: null } }) })
    render(<BackupManagementPanel />)
    expect(await screen.findByText('Planification des sauvegardes')).toBeInTheDocument()
    expect(screen.getByText('Purge des sauvegardes')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/version', { cache: 'no-store' })
  })

  it('sans agent : la section « Sauvegardes » reste visible avec la configuration et le bouton désactivé (explication en infobulle)', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ agentAvailable: false, offsite: null, backup: { policy: {}, stats: null } }) })
    render(<BackupManagementPanel />)
    expect(await screen.findByRole('heading', { name: 'Sauvegardes' })).toBeInTheDocument()
    expect(screen.getByText('Planification des sauvegardes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sauvegarder maintenant' })).toHaveAttribute('title', expect.stringMatching(/doit être installé/))
    expect(screen.getByRole('button', { name: 'Sauvegarder maintenant' })).toBeDisabled()
  })

  it('sans agent : explique à quoi il sert, que la mise à jour reste possible en ligne de commande, et donne la commande d’installation copiable', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ agentAvailable: false, offsite: null, backup: { policy: {}, stats: null } }) })
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<BackupManagementPanel />)
    expect(await screen.findByText('Installer l’agent de mise à jour')).toBeInTheDocument()
    expect(screen.getByText(/sans l’agent, la mise à jour reste possible en ligne de commande/i)).toBeInTheDocument()
    expect(screen.getByText('scripts/update-agent.sh --install')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copier la commande' }))
    expect(writeText).toHaveBeenCalledWith('scripts/update-agent.sh --install')
    expect(await screen.findByText('Commande copiée')).toBeInTheDocument()
  })

  it('avec agent : pas de bloc d’installation', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ agentAvailable: true, offsite: null, backup: { policy: {}, stats: null } }) })
    render(<BackupManagementPanel />)
    await screen.findByRole('heading', { name: 'Sauvegardes' })
    expect(screen.queryByText('Installer l’agent de mise à jour')).toBeNull()
  })

  it('avec agent : « Sauvegarder maintenant » dépose la demande et confirme', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ agentAvailable: true, offsite: null, backup: { policy: {}, stats: null } }) })
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ requested: true }) })
      .mockResolvedValue({ ok: true, json: async () => ({ agentAvailable: true, offsite: null, backup: { policy: {}, stats: null } }) })
    render(<BackupManagementPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sauvegarder maintenant' }))
    expect(await screen.findByText(/Sauvegarde demandée/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/backup/now', { method: 'POST' })
  })

  it('erreur « mise à jour en cours » : message traduit', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ agentAvailable: true, offsite: null, backup: { policy: {}, stats: null } }) })
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'update_in_progress' }) })
    render(<BackupManagementPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sauvegarder maintenant' }))
    expect(await screen.findByText(/mise à jour est en cours/)).toBeInTheDocument()
  })
})
