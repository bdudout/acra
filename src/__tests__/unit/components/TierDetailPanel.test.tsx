import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TierDetailPanel from '@/components/TierDetailPanel'
import { ECHELLES_ECOSYSTEME_DEFAUT } from '@/lib/ecosystem-echelles'

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

  it('contrat groupe (organisation racine) : état de chaque filiale bénéficiaire et proposition d’une nouvelle filiale', async () => {
    const withBeneficiaries = { ...detail, contracts: [{ id: 'a1', reference: 'C-1', ownedHere: true, serviceIds: ['s1'],
      beneficiaries: [{ organizationId: 'f1', nom: 'Filiale 1', status: 'CONFIRMED' }, { organizationId: 'f2', nom: 'Filiale 2', status: 'PROPOSED' }, { organizationId: 'f4', nom: 'Filiale 4', status: 'REJECTED' }],
      proposable: [{ id: 'f3', nom: 'Filiale 3' }, { id: 'f4', nom: 'Filiale 4' }] }] }
    fetchMock.mockImplementation((url: string, init?: RequestInit) => (init?.method && init.method !== 'GET' ? ok({ ok: true }, 201) : url.startsWith('/api/processus') ? ok(processus) : ok(withBeneficiaries)))
    render(<TierDetailPanel tierId="t1" />)
    const box = await screen.findByRole('group', { name: 'Filiales bénéficiaires de C-1' })
    expect(box).toHaveTextContent('Filiale 1'); expect(box).toHaveTextContent('Confirmée')
    expect(box).toHaveTextContent('Proposée'); expect(box).toHaveTextContent('Refusée')
    fireEvent.change(within(box).getByLabelText('Proposer à'), { target: { value: 'f3' } })
    fireEvent.click(within(box).getByRole('button', { name: 'Proposer' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0][0]).toBe('/api/tiers/contracts/a1/beneficiaries')
    expect(JSON.parse(String(posts()[0][1].body))).toEqual({ organizationId: 'f3' })
  })
  it('pas de section bénéficiaires pour un contrat sans filiale ni proposition possible', async () => {
    render(<TierDetailPanel tierId="t1" />)
    await screen.findByText('Offres et usages')
    expect(screen.queryByRole('group', { name: /Filiales bénéficiaires/ })).toBeNull()
  })
})

describe('TierDetailPanel — revue périodique du tiers', () => {
  it('organisation racine : date de dernière revue enregistrée (PATCH) ; ailleurs : prochaine revue en lecture seule', async () => {
    const avecRevue = (modifiable: boolean) => ({ ...detail, tier: { ...detail.tier, derniereRevue: '2026-01-15', prochaineRevue: '2027-01-15', revueModifiable: modifiable, createdAt: '2024-01-01T00:00:00Z' } })
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method && init.method !== 'GET') return ok({ ok: true })
      return url.startsWith('/api/processus') ? ok(processus) : ok(avecRevue(true))
    })
    const { unmount } = render(<TierDetailPanel tierId="t1" />)
    const champ = await screen.findByLabelText('Dernière revue')
    expect(champ).toHaveValue('2026-01-15')
    fireEvent.change(champ, { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la revue' }))
    await screen.findByText('Revue enregistrée.')
    const patch = posts().find(c => c[1].method === 'PATCH')!
    expect(patch[0]).toBe('/api/tier-registry/t1')
    expect(JSON.parse(patch[1].body)).toEqual({ derniereRevue: '2026-10-01' })
    unmount()

    fetchMock.mockImplementation((url: string) => (url.startsWith('/api/processus') ? ok(processus) : ok(avecRevue(false))))
    render(<TierDetailPanel tierId="t1" />)
    expect(await screen.findByText(/Prochaine revue : 15\/01\/2027/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Dernière revue')).toBeNull()
  })
})

describe('TierDetailPanel — évaluation des usages (lot T1)', () => {
  it('badge de zone par usage évalué, « Non évalué » sinon ; synthèse de l’offre ; « Évaluer » ouvre le panneau', async () => {
    const avecEval = { ...detail, services: detail.services.map(s => s.id !== 's1' ? s : {
      ...s, synthese: { menace: 3, zone: 'danger', evalues: 1 },
      usages: s.usages.map(u => (u.id === 'u1' ? { ...u, evaluation: { statut: 'VALIDEE', actuelle: { menace: 3, zone: 'danger' }, cible: { menace: 0.89, zone: 'veille' }, prochaine: '2027-10-09' } } : u)),
    }) }
    fetchMock.mockImplementation((url: string) => (String(url).endsWith('/evaluation') ? ok({ evaluation: null, cotation: { actuelle: null, cible: null }, prochaineEvaluation: null, droits: { peutEvaluer: true, peutValider: false }, echelles: ECHELLES_ECOSYSTEME_DEFAUT, options: { traitements: [], risques: [] } }) : url.startsWith('/api/processus') ? ok(processus) : ok(avecEval)))
    render(<TierDetailPanel tierId="t1" />)
    const li = await offerItem('SignNow Signature')
    expect(within(li).getByText('3 — Danger · Validée')).toBeInTheDocument()
    expect(within(li).getByText('Non évalué')).toBeInTheDocument()
    expect(within(li).getAllByText(/Pire niveau évalué/).length).toBeGreaterThan(0)
    fireEvent.click(within(li).getAllByRole('button', { name: 'Évaluer' })[0])
    expect(await screen.findByRole('region', { name: 'Évaluation — Contrats fournisseurs' })).toBeInTheDocument()
  })
})
