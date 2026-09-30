import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TierIdentityPanel from '@/components/TierIdentityPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
const data = {
  active: true, canManage: true,
  tiers: [
    { id: 't1', nom: 'Acme', lei: '549300ABCDEFGHIJ1234', pays: 'FR', aliases: [], analysesCount: 2, arrangements: [{ id: 'a1', reference: 'C-1' }], coverage: 'CYBER_AND_TIC' },
    { id: 't2', nom: 'Hébergeur TIC', lei: null, pays: null, aliases: [], analysesCount: 0, arrangements: [{ id: 'a2', reference: 'C-2' }], coverage: 'TIC_ONLY' },
    { id: 't3', nom: 'Fournisseur cyber', lei: null, pays: null, aliases: [], analysesCount: 1, arrangements: [], coverage: 'CYBER_ONLY' },
  ],
  unlinkedArrangements: [
    { id: 'a3', reference: 'C-3', prestataireNom: 'Acme Logiciels', lei: '549300ABCDEFGHIJ1234', candidates: [{ tierId: 't1', nom: 'Acme', reason: 'LEI', strength: 'STRONG' }] },
    { id: 'a4', reference: 'C-4', prestataireNom: 'Inconnu SAS', lei: null, candidates: [] },
  ],
}
const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body } as Response)

beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation((_url: string, init?: RequestInit) => (init?.method === 'POST' ? ok({ ok: true }, 201) : ok(data)))
})

describe('TierIdentityPanel — identités de tiers', () => {
  it('liste les tiers avec leur couverture : cyber seulement, TIC seulement, cyber + TIC', async () => {
    render(<TierIdentityPanel />)
    const table = await screen.findByRole('table', { name: 'Identités de tiers' })
    expect(within(table).getByText('Cyber + TIC')).toBeInTheDocument()
    expect(within(table).getByText('TIC seulement')).toBeInTheDocument()
    expect(within(table).getByText('Cyber seulement')).toBeInTheDocument()
    expect(table).toHaveTextContent('C-1'); expect(table).toHaveTextContent('549300ABCDEFGHIJ1234')
  })
  it('arrangement à rapprocher : le candidat fort est proposé avec sa raison ; le lien n’est posé qu’au clic', async () => {
    render(<TierIdentityPanel />)
    const card = (await screen.findByText(/C-3/)).closest('li')!
    expect(card).toHaveTextContent('LEI identique')
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(false)
    fireEvent.click(within(card).getByRole('button', { name: /Lier à « Acme »/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/tier-registry/link', expect.objectContaining({ method: 'POST' })))
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[0] === '/api/tier-registry/link')![1].body)).toEqual({ arrangementId: 'a3', tierId: 't1' })
  })
  it('« Créer un tiers » depuis un arrangement : envoie nom, LEI et l’arrangement à rattacher ; doublon possible : demande confirmation', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return ok(data)
      const body = JSON.parse(String(init.body))
      return body.confirmNew ? ok({ id: 'tNew' }, 201) : ok({ error: 'possible_duplicate', candidates: [{ tierId: 't1', nom: 'Acme', reason: 'NAME', strength: 'WEAK' }] }, 409)
    })
    render(<TierIdentityPanel />)
    const card = (await screen.findByText(/C-3/)).closest('li')!
    fireEvent.click(within(card).getByRole('button', { name: /Créer un tiers/ }))
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[0] === '/api/tier-registry' && c[1]?.method === 'POST')![1].body)).toMatchObject({ nom: 'Acme Logiciels', lei: '549300ABCDEFGHIJ1234', linkArrangementIds: ['a3'] })
    expect(await screen.findByRole('alert')).toHaveTextContent('Acme')
    fireEvent.click(screen.getByRole('button', { name: 'Créer quand même' }))
    await waitFor(() => expect(JSON.parse(fetchMock.mock.calls.filter(c => c[1]?.method === 'POST').at(-1)![1].body).confirmNew).toBe(true))
  })
  it('lecture seule : ni formulaire de création ni boutons d’action', async () => {
    fetchMock.mockImplementation(() => ok({ ...data, canManage: false }))
    render(<TierIdentityPanel />)
    await screen.findByRole('table', { name: 'Identités de tiers' })
    expect(screen.queryByRole('button', { name: /Lier à/ })).toBeNull()
    expect(screen.queryByLabelText('Nom du tiers')).toBeNull()
  })
  it('module inactif ou hors organisation : rien', async () => {
    fetchMock.mockImplementation(() => ok({ active: false, tiers: [], unlinkedArrangements: [] }))
    const { container } = render(<TierIdentityPanel />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
