import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import McpActivity from '@/components/McpActivity'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
const ACTIVITE = {
  instanceActive: true, orgActive: false, jours: 30,
  totaux: { clesActives: 1, clesInactives: 1, appels: 12, erreurs: 2, enAttente: 3, acceptees: 5, rejetees: 1 },
  parJour: [{ jour: '2026-10-07', n: 12 }],
  cles: [
    { id: 'k1', nom: 'Claude Code — RSSI', masque: 'acra_abc_••••', etat: 'ACTIVE', createdAt: '2026-09-01', lastUsedAt: '2026-10-07T10:00:00Z', expiresAt: null, revokedAt: null, appels: 12, erreurs: 2, outils: [{ outil: 'read_projet', n: 7 }], propositions: { EN_ATTENTE: 3, ACCEPTEE: 5, REJETEE: 1 } },
    { id: 'k2', nom: 'Ancienne clé', masque: 'acra_old_••••', etat: 'REVOQUEE', createdAt: '2026-08-01', lastUsedAt: null, expiresAt: null, revokedAt: '2026-09-01', appels: 0, erreurs: 0, outils: [], propositions: { EN_ATTENTE: 0, ACCEPTEE: 0, REJETEE: 0 } },
  ],
}
beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('confirm', () => true)
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (init?.method === 'DELETE') return { ok: true, json: async () => ({ ok: true }) }
    if (init?.method === 'POST') return { ok: true, json: async () => ({ id: 'k3', secret: 'acra_new_SECRET' }) }
    return { ok: true, json: async () => ACTIVITE }
  })
})

describe('McpActivity', () => {
  it('indicateurs, alerte si le MCP est coupé pour l’organisation, détail par clé', async () => {
    render(<McpActivity />)
    expect(await screen.findByText('Claude Code — RSSI')).toBeTruthy()
    expect(screen.getByRole('status')).toHaveTextContent(/désactivé pour cette organisation/)
    expect(screen.getByText('read_projet (7)')).toBeTruthy()
    expect(screen.getByText('Révoquée')).toBeTruthy()
    expect(screen.getByText(/3 en attente · 5 acceptée\(s\) · 1 rejetée\(s\)/)).toBeTruthy()
  })
  it('révoquer une clé active : DELETE sur la clé puis rechargement', async () => {
    render(<McpActivity />)
    fireEvent.click(await screen.findByRole('button', { name: /Révoquer Claude Code — RSSI/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/config/api-keys/k1', { method: 'DELETE' }))
    expect(screen.queryByRole('button', { name: /Révoquer Ancienne clé/ })).toBeNull()
  })
  it('créer une clé MCP : scopes read + mcp, secret montré une fois avec la commande de connexion', async () => {
    render(<McpActivity />)
    await screen.findByText('Claude Code — RSSI')
    fireEvent.change(screen.getByLabelText('Nom de la clé'), { target: { value: 'Codex — analyste' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer une clé MCP' }))
    await screen.findByText('acra_new_SECRET', { selector: 'code' })
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toMatchObject({ name: 'Codex — analyste', scopes: ['read', 'mcp'] })
    expect(screen.getByText(/claude mcp add --transport http acra .*\/api\/mcp --header "Authorization: Bearer acra_new_SECRET"/)).toBeTruthy()
  })
})
