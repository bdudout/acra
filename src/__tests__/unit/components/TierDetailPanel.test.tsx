import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TierDetailPanel from '@/components/TierDetailPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const detail = {
  tier: { id: 't1', nom: 'SignNow', lei: null, pays: 'US' }, orgId: 'fil1', canManage: true, isAdmin: true,
  contracts: [{ id: 'a1', reference: 'C-1', ownedHere: true, serviceIds: ['s1'] }, { id: 'aG', reference: 'C-G', ownedHere: false, serviceIds: ['s1'] }],
  contractServices: [{ id: 'cs1', arrangementId: 'a1', reference: 'C-1', serviceId: 's1' }, { id: 'cs2', arrangementId: 'aG', reference: 'C-G', serviceId: 's1' }],
  services: [
    { id: 's1', nom: 'SignNow Signature', typeService: 'LOGICIEL', description: null, actif: true,
      coveredBy: [{ arrangementId: 'a1', reference: 'C-1', contractServiceId: 'cs1' }, { arrangementId: 'aG', reference: 'C-G', contractServiceId: 'cs2' }],
      usages: [
        { id: 'u1', useCase: 'Contrats fournisseurs', processusId: 'p1', processusNom: 'Achats', contractServiceId: 'cs1', coverage: 'CONFIRMED' },
        { id: 'u2', useCase: 'Contrats de travail', processusId: 'p2', processusNom: 'RH', contractServiceId: null, coverage: 'UNCONFIRMED' },
      ] },
    { id: 's2', nom: 'SignNow Archivage', typeService: 'LOGICIEL', description: null, actif: true, coveredBy: [], usages: [] },
  ],
}
const processus = { processus: [{ id: 'p1', nom: 'Achats' }, { id: 'p2', nom: 'RH' }], active: true }
const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body } as Response)
const fetchMock = vi.fn()
const offerItem = async (name: string) => { await screen.findByText('Offres et usages'); return screen.getAllByRole('listitem').find(li => li.querySelector('p')?.textContent?.startsWith(name))! }
const posts = () => fetchMock.mock.calls.filter(c => c[1]?.method && c[1].method !== 'GET')

beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method && init.method !== 'GET') return ok({ ok: true }, init.method === 'POST' ? 201 : 200)
    return url.startsWith('/api/processus') ? ok(processus) : ok(detail)
  })
})

describe('TierDetailPanel — offres, couverture et usages', () => {
  it('distingue deux offres du même prestataire et montre, par usage, la couverture contractuelle (confirmée / à confirmer)', async () => {
    render(<TierDetailPanel tierId="t1" />)
    const s1 = await offerItem('SignNow Signature')
    expect(await offerItem('SignNow Archivage')).toBeTruthy()
    expect(s1).toHaveTextContent('C-1'); expect(s1).toHaveTextContent('C-G')
    expect(within(s1).getByText('Contrats fournisseurs').closest('li')).toHaveTextContent('Achats')
    expect(within(s1).getByText('Contrats fournisseurs').closest('li')).toHaveTextContent('Couverture confirmée')
    expect(within(s1).getByText('Contrats de travail').closest('li')).toHaveTextContent('Couverture contractuelle à confirmer')
    expect(await offerItem('SignNow Archivage')).toHaveTextContent('Hors contrat recensé')
  })
  it('ajoute une offre (catégorie = attribut)', async () => {
    render(<TierDetailPanel tierId="t1" />)
    await screen.findByText('Offres et usages')
    fireEvent.change(screen.getByLabelText('Nom de l’offre'), { target: { value: 'SignNow Sceau' } })
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'SECURITE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter l’offre' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0][0]).toBe('/api/tier-registry/t1/services')
    expect(JSON.parse(String(posts()[0][1].body))).toEqual({ nom: 'SignNow Sceau', typeService: 'SECURITE' })
  })
  it('couverture d’un contrat de l’organisation : coche les offres couvertes et enregistre ; seuls les contrats de l’organisation sont modifiables', async () => {
    render(<TierDetailPanel tierId="t1" />)
    await screen.findByText('Offres et usages')
    const editor = screen.getByRole('group', { name: /Offres couvertes par C-1/ })
    expect(screen.queryByRole('group', { name: /Offres couvertes par C-G/ })).toBeNull() // contrat groupe : lecture seule
    fireEvent.click(within(editor).getByRole('checkbox', { name: 'SignNow Archivage' }))
    fireEvent.click(within(editor).getByRole('button', { name: 'Enregistrer la couverture' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0][0]).toBe('/api/tier-registry/contracts/a1/services'); expect(posts()[0][1].method).toBe('PUT')
    expect(JSON.parse(String(posts()[0][1].body)).serviceIds.sort()).toEqual(['s1', 's2'])
  })
  it('retrait refusé (usages existants) : message clair avec le nombre d’usages', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return ok({ error: 'has_usages', blocked: [{ serviceId: 's1', usages: 2 }] }, 409)
      return url.startsWith('/api/processus') ? ok(processus) : ok(detail)
    })
    render(<TierDetailPanel tierId="t1" />)
    await screen.findByText('Offres et usages')
    const editor = screen.getByRole('group', { name: /Offres couvertes par C-1/ })
    fireEvent.click(within(editor).getByRole('checkbox', { name: 'SignNow Signature' }))
    fireEvent.click(within(editor).getByRole('button', { name: 'Enregistrer la couverture' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('2 usage(s)')
  })
  it('ajoute un usage (cas métier, processus, contrat ou hors contrat) via la route d’usage existante', async () => {
    render(<TierDetailPanel tierId="t1" />)
    const s2 = await offerItem('SignNow Archivage')
    fireEvent.change(within(s2).getByLabelText('Cas d’usage'), { target: { value: 'Archivage des paies' } })
    fireEvent.change(within(s2).getByLabelText('Processus'), { target: { value: 'p2' } })
    fireEvent.click(within(s2).getByRole('button', { name: 'Ajouter l’usage' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0][0]).toBe('/api/tiers/services/s2/usages')
    expect(JSON.parse(String(posts()[0][1].body))).toEqual({ organizationId: 'fil1', useCase: 'Archivage des paies', processusId: 'p2' })
  })
  it('supprime un usage ; rôles sans droit : aucun formulaire ni bouton', async () => {
    render(<TierDetailPanel tierId="t1" />)
    const u1 = (await screen.findByText('Contrats fournisseurs')).closest('li')!
    fireEvent.click(within(u1).getByRole('button', { name: /Supprimer l’usage/ }))
    await waitFor(() => expect(posts().some(c => c[0] === '/api/tier-registry/usages/u1' && c[1].method === 'DELETE')).toBe(true))
  })
  it('lecture seule', async () => {
    fetchMock.mockImplementation((url: string) => (url.startsWith('/api/processus') ? ok(processus) : ok({ ...detail, canManage: false, isAdmin: false })))
    render(<TierDetailPanel tierId="t1" />)
    await screen.findByText('Offres et usages')
    expect(screen.queryByLabelText('Nom de l’offre')).toBeNull(); expect(screen.queryByLabelText('Cas d’usage')).toBeNull()
    expect(screen.queryByRole('button', { name: /Supprimer l’usage/ })).toBeNull()
  })
})
