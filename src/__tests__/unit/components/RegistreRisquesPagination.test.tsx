// Registre des risques paginé côté serveur (lot V1) : requête paginée, deep-link ?niveau=, filtres de colonnes et
// tri placés dans l'URL (clés, pas libellés), barre de pagination, rechargement après une action.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RegistreRisques from '@/components/RegistreRisques'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useSearchParams: () => nav.params, useRouter: () => ({ replace: nav.replace }), usePathname: () => '/registre' }))
vi.mock('@/components/AutocompleteInput', () => ({ default: () => <input /> }))
vi.mock('@/components/SectorSuggestionsPanel', () => ({ default: () => null }))
vi.mock('@/components/RisquesViewTabs', () => ({ default: () => null }))

const risk = (id: string, intitule: string, o: Record<string, unknown> = {}) => ({
  id, intitule, taxonomieCode: null, processusId: null, processusNom: null, entite: null, proprietaire: null, statut: 'IDENTIFIE', provenance: 'MANUEL',
  graviteInherente: null, vraisemblanceInherente: null, graviteResiduelle: null, vraisemblanceResiduelle: null, niveauInherent: null, niveauResiduel: null,
  actionsSummary: { total: 0, faits: 0, enCours: 0, aFaire: 0, enRetard: 0, tauxAvancement: 0 }, calibration: null, controleEfficacite: null, ...o,
})
const fetchMock = vi.fn()
const ok = (b: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => b } as Response)
beforeEach(() => {
  fetchMock.mockReset(); nav.replace.mockClear(); nav.params = new URLSearchParams()
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.startsWith('/api/risk-items?') && !init?.method) return ok({
      active: true, risks: [risk('r1', 'Fraude au président', { statut: 'TRAITE' })],
      pagination: { page: 1, taille: 50, total: 120, pages: 3 },
      synthese: { total: 120, entiteFrequente: 'DSI', valeurs: { category: [''], process: [], statut: ['IDENTIFIE', 'TRAITE'] } },
    })
    if (url === '/api/taxonomie') return ok({ taxonomie: [] })
    if (url === '/api/processus') return ok({ processus: [] })
    return ok({ ok: true })
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('confirm', () => true)
})
const listeCalls = () => fetchMock.mock.calls.filter(c => (c[0] as string).startsWith('/api/risk-items?') && !c[1]?.method)

describe('RegistreRisques — liste paginée côté serveur', () => {
  it('interroge la route paginée avec le deep-link ?niveau= et affiche la pagination', async () => {
    nav.params = new URLSearchParams('niveau=eleve')
    render(<RegistreRisques canEdit />)
    expect(await screen.findByText('Fraude au président')).toBeTruthy()
    expect(listeCalls()[0][0]).toBe('/api/risk-items?niveau=eleve&page=1')
    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeTruthy()
    expect(screen.getByText(/120/)).toBeTruthy()
  })
  it('filtre de colonne → clés dans l’URL ; tri → tri/ordre dans l’URL', async () => {
    render(<RegistreRisques canEdit />)
    await screen.findByText('Fraude au président')
    const statut = screen.getAllByRole('columnheader').find(th => th.textContent?.includes('Statut'))!
    fireEvent.click(within(statut).getByRole('button', { name: 'Trier et filtrer' }))
    fireEvent.click(within(within(statut).getByText('Traité').closest('li')!).getByRole('checkbox'))
    expect(nav.replace).toHaveBeenLastCalledWith(`/registre?col_statut=${encodeURIComponent('["IDENTIFIE"]')}`, { scroll: false })
    fireEvent.click(within(statut).getByRole('button', { name: /^Statut/ }))
    expect(nav.replace).toHaveBeenLastCalledWith(`/registre?col_statut=${encodeURIComponent('["IDENTIFIE"]')}&tri=statut&ordre=asc`, { scroll: false })
  })
  it('une suppression recharge la page courante', async () => {
    render(<RegistreRisques canEdit />)
    await screen.findByText('Fraude au président')
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(listeCalls()).toHaveLength(2))
    expect(fetchMock.mock.calls.some(c => c[0] === '/api/risk-items/r1' && c[1]?.method === 'DELETE')).toBe(true)
  })
})
