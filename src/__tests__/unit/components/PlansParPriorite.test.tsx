import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlansParPriorite from '@/components/projet360/PlansParPriorite'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('PlansParPriorite', () => {
  it('liste les plans dans l’ordre reçu, risque visé et niveau, retard signalé', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ plans: [
      { id: 'b', titre: 'Chiffrer les sauvegardes', statut: 'EN_COURS', priorite: 'CRITIQUE', echeance: '2026-09-01T00:00:00Z', porteur: 'DSI', risques: [{ id: 'r1', nom: 'Fuite de données', niveau: 12 }], niveauMax: 12, enRetard: true },
      { id: 'a', titre: 'Former l’équipe', statut: 'A_FAIRE', priorite: 'MAJEUR', echeance: null, porteur: null, risques: [{ id: 'r2', nom: 'Retard', niveau: 4 }], niveauMax: 4, enRetard: false },
    ] }) })
    render(<PlansParPriorite analyseId="p1" />)
    const rows = (await screen.findAllByRole('row')).slice(1)
    expect(within(rows[0]).getByText('Chiffrer les sauvegardes')).toBeTruthy()
    expect(within(rows[0]).getByText(/Fuite de données/)).toBeTruthy()
    expect(within(rows[0]).getByText('En retard')).toBeTruthy()
    expect(within(rows[0]).getByText('Critique')).toBeTruthy()
    expect(within(rows[1]).getByText('Former l’équipe')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith('/api/analyses/p1/plans-projet', expect.anything())
  })
  it('aucun plan : message d’aide', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ plans: [] }) })
    render(<PlansParPriorite analyseId="p1" />)
    expect(await screen.findByText(/Aucun plan d’action pour l’instant/)).toBeTruthy()
  })
})

describe('PlansParPriorite — édition (chef de projet)', () => {
  const plan = { id: 'a', titre: 'Faire qualifier par le DPO', statut: 'A_FAIRE', priorite: 'MAJEUR', echeance: '2026-12-01T00:00:00.000Z', porteur: null, risques: [{ id: 'r2', nom: 'RGPD', niveau: 6 }], niveauMax: 6, enRetard: false }
  it('porteur, échéance et statut modifiables ; enregistrés sur le plan du risque', async () => {
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => Promise.resolve({ ok: true, json: async () => (init?.method === 'PATCH' ? { plan: { ...plan, ...JSON.parse(String(init.body)) } } : { plans: [plan] }) }))
    render(<PlansParPriorite analyseId="p1" editable />)
    const ligne = (await screen.findAllByRole('row'))[1]
    const porteur = within(ligne).getByLabelText('Porteur — Faire qualifier par le DPO')
    fireEvent.change(porteur, { target: { value: 'DPO' } })
    fireEvent.blur(porteur)
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PATCH')).toBe(true))
    const patch = fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')!
    expect(patch[0]).toBe('/api/analyses/p1/risques/r2/plans/a')
    expect(JSON.parse(patch[1].body)).toEqual({ porteur: 'DPO' })
    fireEvent.change(within(ligne).getByLabelText('Échéance — Faire qualifier par le DPO'), { target: { value: '2026-11-15' } })
    fireEvent.change(within(ligne).getByLabelText('Statut — Faire qualifier par le DPO'), { target: { value: 'EN_COURS' } })
    await waitFor(() => expect(fetchMock.mock.calls.filter(c => c[1]?.method === 'PATCH')).toHaveLength(3))
    expect(JSON.parse(fetchMock.mock.calls.filter(c => c[1]?.method === 'PATCH')[1][1].body)).toEqual({ echeance: '2026-11-15' })
  })
  it('signale un plan prévu après la mise en service', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ plans: [plan] }) })
    render(<PlansParPriorite analyseId="p1" miseEnService="2026-11-20" />)
    expect(await screen.findByText('Après la mise en service')).toBeTruthy()
  })
})
