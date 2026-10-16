// @vitest-environment jsdom
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

// ─── Brouillon local (intégrité : une saisie non enregistrée n'est jamais perdue) ─────────────
import { lireBrouillon, effacerBrouillon, renvoyerBrouillon } from '@/lib/atelier-save'

describe('brouillon local d\'atelier', () => {
  afterEach(() => { localStorage.clear(); vi.unstubAllGlobals() })

  it('échec (réseau ou serveur) → la saisie est gardée avec la révision sur laquelle elle s\'appuie ; nouvelle tentative possible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const err = await enregistrerAtelier('an1', 2, { sourcesRisque: [{ nom: 'X' }] }, { current: 3 }, msgs).catch(e => e)
    expect(err.message).toBe(msgs.echec)
    expect(err.reessayable).toBe(true)
    const b = lireBrouillon('an1', 2)
    expect(b).toMatchObject({ data: { sourcesRisque: [{ nom: 'X' }] }, revision: 3 })
    expect(typeof b!.date).toBe('string')
  })
  it('conflit (409) : brouillon gardé, erreur NON réessayable (ne pas écraser le travail d\'un autre)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reponse(409, { error: 'CONFLIT_EDITION', revision: 5 })))
    const err = await enregistrerAtelier('an1', 2, { a: 1 }, { current: 3 }, msgs).catch(e => e)
    expect(err.reessayable).toBe(false)
    expect(lireBrouillon('an1', 2)?.revision).toBe(3)
  })
  it('succès : le brouillon est effacé', async () => {
    localStorage.setItem('acra:brouillon-atelier:an1:2', JSON.stringify({ data: {}, revision: 1, date: 'x' }))
    vi.stubGlobal('fetch', vi.fn(async () => reponse(200, { ok: true, revision: 2 })))
    await enregistrerAtelier('an1', 2, { a: 1 }, { current: 1 }, msgs)
    expect(lireBrouillon('an1', 2)).toBeNull()
  })
  it('renvoi d\'un brouillon après rechargement : envoyé avec SA révision d\'origine', async () => {
    localStorage.setItem('acra:brouillon-atelier:an1:4', JSON.stringify({ data: { scenariosOperationnels: [] }, revision: 7, date: 'x' }))
    const f = vi.fn(async () => reponse(200, { ok: true, revision: 8 }))
    vi.stubGlobal('fetch', f)
    expect(await renvoyerBrouillon('an1', 4, msgs)).toBe('ok')
    expect(((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>)['If-Match']).toBe('7')
    expect(lireBrouillon('an1', 4)).toBeNull()
  })
  it('renvoi refusé par conflit : brouillon conservé (téléchargeable)', async () => {
    localStorage.setItem('acra:brouillon-atelier:an1:4', JSON.stringify({ data: {}, revision: 7, date: 'x' }))
    vi.stubGlobal('fetch', vi.fn(async () => reponse(409, { error: 'CONFLIT_EDITION' })))
    expect(await renvoyerBrouillon('an1', 4, msgs)).toBe('conflit')
    expect(lireBrouillon('an1', 4)).not.toBeNull()
    effacerBrouillon('an1', 4)
    expect(lireBrouillon('an1', 4)).toBeNull()
  })
  it('stockage indisponible (navigation privée) : aucune exception', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(lireBrouillon('an1', 1)).toBeNull()
    vi.restoreAllMocks()
  })
})
