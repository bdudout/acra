import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TierIdentityPanel from '@/components/TierIdentityPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

vi.mock('@/components/TierDetailPanel', () => ({ default: ({ tierId }: { tierId: string }) => <div data-testid={`detail-${tierId}`} /> }))

const fetchMock = vi.fn()
const data = {
  active: true, canManage: true, isAdmin: true, orgId: 'fil1', proposals: [{ arrangementId: 'aG', reference: 'CG-7', prestataireNom: 'Hébergeur Groupe', ownerNom: 'Holding' }],
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

  it('fiche d’un tiers : « Offres et usages » déplie la fiche (offres, couverture, usages) du tiers choisi', async () => {
    render(<TierIdentityPanel />)
    const row = (await screen.findByRole('table', { name: 'Identités de tiers' })).querySelectorAll('tbody tr')[0] as HTMLElement
    expect(screen.queryByTestId('detail-t1')).toBeNull()
    const toggle = within(row).getByRole('button', { name: /Offres et usages/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(screen.getByTestId('detail-t1')).toBeInTheDocument(); expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle); expect(screen.queryByTestId('detail-t1')).toBeNull()
  })
  it('contrat groupe proposé à l’organisation : confirmer ou refuser (ADMIN), rien n’est accordé avant la décision', async () => {
    render(<TierIdentityPanel />)
    const box = (await screen.findByText(/CG-7/)).closest('li')!
    expect(box).toHaveTextContent('Holding'); expect(box).toHaveTextContent('Hébergeur Groupe')
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PATCH')).toBe(false)
    fireEvent.click(within(box).getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/tiers/contracts/aG/beneficiaries/fil1', expect.objectContaining({ method: 'PATCH' })))
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')![1].body)).toEqual({ decision: 'CONFIRM' })
  })
  it('refuser envoie REJECT ; un non-admin voit la proposition sans boutons', async () => {
    render(<TierIdentityPanel />)
    fireEvent.click(within((await screen.findByText(/CG-7/)).closest('li')!).getByRole('button', { name: 'Refuser' }))
    await waitFor(() => expect(JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')![1].body)).toEqual({ decision: 'REJECT' }))
  })
  it('non-admin : proposition visible, aucune décision possible', async () => {
    fetchMock.mockImplementation(() => ok({ ...data, isAdmin: false }))
    render(<TierIdentityPanel />)
    const box = (await screen.findByText(/CG-7/)).closest('li')!
    expect(within(box).queryByRole('button', { name: 'Confirmer' })).toBeNull()
  })

  it('fusion de deux identités : aperçu des relations déplacées, blocage expliqué, confirmation explicite', async () => {
    const preview = { ok: true, source: { id: 't3', nom: 'Fournisseur cyber' }, target: { id: 't1', nom: 'Acme' }, counts: { arrangements: 0, parties: 2, services: 1, usages: 3 } }
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && url === '/api/tier-registry/merge') return ok({ ok: true })
      if (url.startsWith('/api/tier-registry/merge?')) return ok(preview)
      return ok(data)
    })
    render(<TierIdentityPanel />)
    const row = (await screen.findByRole('table', { name: 'Identités de tiers' })).querySelectorAll('tbody tr')[2] as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: /Fusionner — Fournisseur cyber/ }))
    fireEvent.change(screen.getByLabelText('Fusionner dans'), { target: { value: 't1' } })
    const box = await screen.findByTestId('merge-preview')
    expect(box).toHaveTextContent('2 partie(s) prenante(s)'); expect(box).toHaveTextContent('1 offre(s)'); expect(box).toHaveTextContent('3 usage(s)')
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST' && c[0] === '/api/tier-registry/merge')).toBe(false) // rien avant confirmation
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la fusion' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/tier-registry/merge', expect.objectContaining({ method: 'POST' })))
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[0] === '/api/tier-registry/merge' && c[1]?.method === 'POST')![1].body)).toEqual({ sourceId: 't3', targetId: 't1' })
  })
  it('fusion bloquée (données d’une autre organisation) : raison affichée, pas de bouton de confirmation', async () => {
    fetchMock.mockImplementation((url: string) => (url.startsWith('/api/tier-registry/merge?') ? ok({ ok: false, error: 'shared_with_other_organizations', source: { id: 't3', nom: 'x' }, target: { id: 't1', nom: 'y' }, counts: { arrangements: 0, parties: 0, services: 0, usages: 0 } }) : ok(data)))
    render(<TierIdentityPanel />)
    const row = (await screen.findByRole('table', { name: 'Identités de tiers' })).querySelectorAll('tbody tr')[2] as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: /Fusionner — Fournisseur cyber/ }))
    fireEvent.change(screen.getByLabelText('Fusionner dans'), { target: { value: 't1' } })
    expect(await screen.findByTestId('merge-preview')).toHaveTextContent('administrateur du groupe')
    expect(screen.queryByRole('button', { name: 'Confirmer la fusion' })).toBeNull()
  })
})
