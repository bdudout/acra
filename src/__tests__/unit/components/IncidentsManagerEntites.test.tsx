// Incidents filtrés par entité (consolidation, lot E5) : lien au référentiel ou texte libre identique, sous-entités
// incluses ou non.
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IncidentsManager from '@/components/IncidentsManager'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/components/AutocompleteInput', () => ({ default: () => <input /> }))

const inc = (id: string, intitule: string, o: Record<string, unknown>) => ({
  id, intitule, description: null, dateSurvenance: '2026-10-05T00:00:00.000Z', dateDetection: null, taxonomieCode: null, processusId: null, processusNom: null,
  entite: null, entiteId: null, impactEstime: null, montantBrut: null, recuperations: null, perteNette: null, delaiDetection: 0, riskItemId: null, riskItemIntitule: null, risques: [],
  statut: 'DECLARE', createdAt: '2026-10-05T09:00:00.000Z', l1: { horloges: [], nbEnRetard: 0, totaux: { net: 0 }, seuils: { collectee: false, grandePerte: false } }, ...o,
})
const E = (id: string, nom: string, o: Record<string, unknown> = {}) => ({ id, nom, type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null, ...o })
const fetchMock = vi.fn()
const ok = (b: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => b } as Response)
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === '/api/incidents' && !init?.method) return ok({ active: true, incidents: [
      inc('i1', 'Panne du routeur', { entiteId: 'ret' }),
      inc('i2', 'Fuite de données RH', { entite: 'DSI' }),
      inc('i3', 'Fraude fournisseur', { entite: 'Achats' }),
    ] })
    if (url === '/api/referentiel-entites') return ok({ entites: [E('dsi', 'Direction des SI', { alias: ['DSI'] }), E('ret', 'Réseaux', { parentId: 'dsi' })] })
    return ok({ ok: true })
  })
  vi.stubGlobal('fetch', fetchMock)
})

describe('IncidentsManager — filtre par entité', () => {
  it('entité choisie : incidents liés ou au texte identique, sous-entités comprises puis exclues', async () => {
    render(<IncidentsManager canQualify />)
    expect(await screen.findByText('Fraude fournisseur')).toBeTruthy()
    fireEvent.change(await screen.findByLabelText('Entité'), { target: { value: 'dsi' } })
    expect(screen.getByText('Panne du routeur')).toBeTruthy()
    expect(screen.getByText('Fuite de données RH')).toBeTruthy()
    expect(screen.queryByText('Fraude fournisseur')).toBeNull()
    fireEvent.click(screen.getByLabelText('avec les sous-entités'))
    expect(screen.queryByText('Panne du routeur')).toBeNull()
    expect(screen.getByText('Fuite de données RH')).toBeTruthy()
  })
})
