import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import VersionCard from '@/components/VersionCard'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const base = { latestName: null, releaseUrl: null, publishedAt: null, reachable: true, repo: 'bdudout/acra', deployConfigured: false, updateStatus: null }
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('confirm', () => true) })
const ok = (b: unknown) => Promise.resolve({ ok: true, json: async () => b } as Response)

describe('VersionCard (#185)', () => {
  it('bêta basée sur la dernière version validée ; bouton → demande pour le même canal', async () => {
    fetchMock.mockReturnValueOnce(ok({ ...base, current: '1.0.4-beta.1', channel: 'beta', base: 'v1.0.3', latest: 'v1.0.3', updateAvailable: false, agentAvailable: true }))
    render(<VersionCard />)
    expect(await screen.findByText('Canal bêta — basé sur la dernière version validée v1.0.3')).toBeTruthy()
    fetchMock.mockReturnValueOnce(ok({ requested: true })).mockReturnValue(ok({ ...base, current: '1.0.4-beta.1', channel: 'beta', base: 'v1.0.3', latest: 'v1.0.3', updateAvailable: false, agentAvailable: true }))
    fireEvent.click(screen.getByRole('button', { name: /Mettre à jour/ }))
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')
      expect(post?.[0]).toBe('/api/admin/version/update')
      expect(JSON.parse(post![1].body)).toEqual({ channel: 'beta' })
    })
  })

  it('régression #185 : stable 1.0.3 face à v1.0.3 → à jour, sans agent → commandes proposées', async () => {
    fetchMock.mockReturnValueOnce(ok({ ...base, current: '1.0.3', channel: 'stable', base: null, latest: 'v1.0.3', updateAvailable: false, agentAvailable: false }))
    render(<VersionCard />)
    expect(await screen.findByText(/Application à jour \(dernière release v1\.0\.3\)/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Mettre à jour/ })).toBeNull()
    expect(screen.getByText('scripts/update.sh stable')).toBeTruthy()
    expect(screen.getByText('scripts/update-agent.sh --install')).toBeTruthy()
  })

  // Cas historiques (repris du test d'origine, écrasé par erreur puis restauré).
  it('affiche « Mise à jour disponible » quand updateAvailable', async () => {
    fetchMock.mockReturnValueOnce(ok({ ...base, current: '1.0.0', channel: 'stable', base: null, latest: 'v1.1.0', releaseUrl: 'https://x/rel', updateAvailable: true, agentAvailable: false }))
    render(<VersionCard />)
    expect(await screen.findByText(/Mise à jour disponible/)).toBeTruthy()
    expect(screen.getByText('1.0.0')).toBeTruthy()
  })

  it('affiche « à jour » quand pas de mise à jour', async () => {
    fetchMock.mockReturnValueOnce(ok({ ...base, current: '1.1.0', channel: 'stable', base: null, latest: 'v1.1.0', updateAvailable: false, agentAvailable: false }))
    render(<VersionCard />)
    await waitFor(() => expect(screen.getByText(/Application à jour/)).toBeTruthy())
  })

  it('signale l’indisponibilité si GitHub injoignable', async () => {
    fetchMock.mockReturnValueOnce(ok({ ...base, current: '1.0.0', channel: 'stable', base: null, latest: null, updateAvailable: false, reachable: false, agentAvailable: false }))
    render(<VersionCard />)
    await waitFor(() => expect(screen.getByText(/indisponible/i)).toBeTruthy())
  })
})
