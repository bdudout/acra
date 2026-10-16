import { afterEach, describe, it, expect, vi } from 'vitest'
import { enregistrerAtelier } from '@/lib/atelier-save'

const msgs = { conflit: 'Modifié par un autre utilisateur', echec: 'Sauvegarde échouée' }
const reponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
afterEach(() => vi.unstubAllGlobals())

describe('enregistrerAtelier', () => {
  it('envoie la révision connue en If-Match et retient celle renvoyée', async () => {
    const fetchMock = vi.fn(async () => reponse(200, { ok: true, revision: 4 }))
    vi.stubGlobal('fetch', fetchMock)
    const revision = { current: 3 }
    await enregistrerAtelier('an1', 2, { sourcesRisque: [] }, revision, msgs)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/analyses/an1/workshop/2')
    expect(init.method).toBe('PUT')
    expect((init.headers as Record<string, string>)['If-Match']).toBe('3')
    expect(revision.current).toBe(4)
  })
  it('409 → erreur « modifié par un autre utilisateur », révision inchangée', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reponse(409, { error: 'CONFLIT_EDITION', revision: 7 })))
    const revision = { current: 3 }
    await expect(enregistrerAtelier('an1', 2, {}, revision, msgs)).rejects.toThrow(msgs.conflit)
    expect(revision.current).toBe(3)
  })
  it('autre échec → message d\'échec', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reponse(500, { error: 'x' })))
    await expect(enregistrerAtelier('an1', 2, {}, { current: 0 }, msgs)).rejects.toThrow(msgs.echec)
  })
})
