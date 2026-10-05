import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('n’affiche pas de commandes de sauvegarde quand elles ne sont pas disponibles', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ agentAvailable: false, backup: null }) })
    render(<BackupManagementPanel />)
    expect(await screen.findByText(/agent/i)).toBeInTheDocument()
    expect(screen.queryByText('Purge des sauvegardes')).not.toBeInTheDocument()
  })
})
