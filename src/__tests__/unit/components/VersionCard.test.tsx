import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import VersionCard from '@/components/VersionCard'

function mockFetchOnce(data: Record<string, unknown>) {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => data }) as unknown as typeof fetch
}

describe('VersionCard', () => {
  it('affiche « Mise à jour disponible » quand updateAvailable', async () => {
    mockFetchOnce({ current: '1.0.0', latest: 'v1.1.0', releaseUrl: 'https://x/rel', updateAvailable: true, reachable: true, repo: 'o/r' })
    render(<VersionCard />)
    expect(await screen.findByText(/Mise à jour disponible/)).toBeTruthy()
    expect(screen.getByText('1.0.0')).toBeTruthy()
  })

  it('affiche « à jour » quand pas de mise à jour', async () => {
    mockFetchOnce({ current: '1.1.0', latest: 'v1.1.0', releaseUrl: null, updateAvailable: false, reachable: true, repo: 'o/r' })
    render(<VersionCard />)
    await waitFor(() => expect(screen.getByText(/Application à jour/)).toBeTruthy())
  })

  it('signale l’indisponibilité si GitHub injoignable', async () => {
    mockFetchOnce({ current: '1.0.0', latest: null, updateAvailable: false, reachable: false, repo: 'o/r' })
    render(<VersionCard />)
    await waitFor(() => expect(screen.getByText(/indisponible/i)).toBeTruthy())
  })
})
