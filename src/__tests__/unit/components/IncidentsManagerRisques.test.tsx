import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IncidentsManager from '@/components/IncidentsManager'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/components/AutocompleteInput', () => ({ default: () => <input /> }))

const incident = {
  id: 'i1', intitule: 'Déni de service distribué (DDoS) : service indisponible', description: null, dateSurvenance: '2026-10-05T00:00:00.000Z', dateDetection: null,
  taxonomieCode: null, processusId: null, processusNom: 'Service bancaire', entite: null, impactEstime: null, montantBrut: null, recuperations: null, perteNette: null, delaiDetection: 0,
  riskItemId: 'r1', riskItemIntitule: 'Déni de service sur les services en ligne', risques: [{ id: 'r1', intitule: 'Déni de service sur les services en ligne' }],
  statut: 'DECLARE', createdAt: '2026-10-05T09:00:00.000Z', l1: { horloges: [], nbEnRetard: 0, totaux: { net: 0 }, seuils: { collectee: false, grandePerte: false } },
}
const risks = [{ id: 'r1', intitule: 'Déni de service sur les services en ligne' }, { id: 'r2', intitule: 'Indisponibilité du centre de données' }]
const fetchMock = vi.fn()
const ok = (b: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => b } as Response)
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === '/api/incidents' && !init?.method) return ok({ incidents: [incident], active: true })
    if (url === '/api/taxonomie') return ok({ taxonomie: [] })
    if (url === '/api/processus') return ok({ processus: [] })
    if (url === '/api/risk-items') return ok({ risks })
    return ok({ ok: true })
  })
  vi.stubGlobal('fetch', fetchMock)
})

describe('IncidentsManager — risques associés', () => {
  it('la colonne liste les risques associés ; « Associer des risques » enregistre plusieurs risques du registre', async () => {
    render(<IncidentsManager canQualify />)
    expect(await screen.findByText('Déni de service distribué (DDoS) : service indisponible')).toBeTruthy()
    const row = screen.getByText('Déni de service distribué (DDoS) : service indisponible').closest('tr')!
    expect(within(row).getByText('Déni de service sur les services en ligne')).toBeTruthy()
    // Tableau compact : le processus est repris sous l'intitulé ; les actions sont regroupées dans un menu.
    expect(within(row.querySelector('td')!).getByText(/Service bancaire/)).toBeTruthy()
    expect(within(row).getByText('Actions', { selector: 'summary' })).toBeTruthy()
    // Déjà rattaché : « Créer le risque » n'est plus proposé.
    expect(within(row).queryByRole('button', { name: 'Créer le risque' })).toBeNull()
    fireEvent.click(within(row).getByRole('button', { name: 'Associer des risques' }))
    const panel = await screen.findByRole('region', { name: 'Risques du registre associés' })
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Indisponibilité du centre de données' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Enregistrer les associations' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[0] === '/api/incidents/i1' && c[1]?.method === 'PATCH')).toBe(true))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[0] === '/api/incidents/i1' && c[1]?.method === 'PATCH')![1].body)
    expect(body).toEqual({ riskItemIds: ['r1', 'r2'] })
  })
})
