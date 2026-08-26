/**
 * WebhooksManager.test.tsx — gestion des webhooks sortants (config ADMIN).
 *  - Liste les webhooks existants (fetch mocké)
 *  - Création : POST + affichage du secret une seule fois
 *  - Bouton « Créer » désactivé sans URL ni événement
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WebhooksManager from '@/components/WebhooksManager'

const listResponse = {
  webhooks: [
    { id: 'w1', name: 'Alerting SOC', url: 'https://hooks.example.com/soc', events: ['risk.created'], actif: true, createdAt: '2026-08-26T10:00:00Z' },
  ],
}

function mockFetchSequence() {
  const fetchMock = vi.fn()
  // 1er appel : reload initial (liste)
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => listResponse })
  return fetchMock
}

describe('WebhooksManager', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('liste les webhooks existants', async () => {
    vi.stubGlobal('fetch', mockFetchSequence())
    render(<WebhooksManager />)
    expect(await screen.findByText('Alerting SOC')).toBeInTheDocument()
    expect(screen.getByText('https://hooks.example.com/soc')).toBeInTheDocument()
  })

  it('désactive « Créer » tant qu’il manque URL ou événement', async () => {
    vi.stubGlobal('fetch', mockFetchSequence())
    render(<WebhooksManager />)
    await screen.findByText('Alerting SOC')
    const btn = screen.getByRole('button', { name: /Créer un webhook/i })
    expect(btn).toBeDisabled()
  })

  it('crée un webhook et affiche le secret une seule fois', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ webhooks: [] }) }) // reload initial
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'w2', secret: 'whsec_TOPSECRET' }) }) // POST
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => listResponse }) // reload après création
    vi.stubGlobal('fetch', fetchMock)

    render(<WebhooksManager />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByPlaceholderText('https://…'), { target: { value: 'https://hooks.example.com/x' } })
    fireEvent.click(screen.getByText('risk.created'))
    fireEvent.click(screen.getByRole('button', { name: /Créer un webhook/i }))

    expect(await screen.findByText('whsec_TOPSECRET')).toBeInTheDocument()
    const post = fetchMock.mock.calls[1]
    expect(post[0]).toBe('/api/config/webhooks')
    expect(JSON.parse(post[1].body).events).toContain('risk.created')
  })
})
