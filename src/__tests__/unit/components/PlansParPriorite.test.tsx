import { render, screen, within } from '@testing-library/react'
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
