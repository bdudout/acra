// Incidents filtrés par entité (consolidation, lot E5) : lien au référentiel ou texte libre identique, sous-entités
// incluses ou non. Liste paginée côté serveur (lot V1) : le filtre passe par l'URL et s'exécute sur le serveur
// (règles testées dans incidents-liste.test.ts).
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IncidentsManager from '@/components/IncidentsManager'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useSearchParams: () => nav.params, useRouter: () => ({ replace: nav.replace }), usePathname: () => '/incidents' }))
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
  nav.replace.mockClear()
  nav.params = new URLSearchParams()
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.startsWith('/api/incidents?') && !url.includes('vue=') && !init?.method) return ok({ active: true, incidents: [
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
  it('choisir une entité (puis exclure les sous-entités) place le filtre dans l’URL et revient à la page 1', async () => {
    nav.params = new URLSearchParams('page=3')
    render(<IncidentsManager canQualify />)
    expect(await screen.findByText('Fraude fournisseur')).toBeTruthy()
    fireEvent.change(await screen.findByLabelText('Entité'), { target: { value: 'dsi' } })
    expect(nav.replace).toHaveBeenLastCalledWith('/incidents?entite=dsi', { scroll: false })
  })
  it('filtre présent dans l’URL : transmis au serveur avec les sous-entités exclues', async () => {
    nav.params = new URLSearchParams('entite=dsi&sousEntites=0')
    render(<IncidentsManager canQualify />)
    await screen.findByText('Fraude fournisseur')
    const url = fetchMock.mock.calls.map(c => c[0] as string).find(u => u.startsWith('/api/incidents?'))!
    const q = new URLSearchParams(url.split('?')[1])
    expect(q.get('entite')).toBe('dsi'); expect(q.get('sousEntites')).toBe('0'); expect(q.get('page')).toBe('1')
    fireEvent.click(await screen.findByLabelText('avec les sous-entités'))
    expect(nav.replace).toHaveBeenLastCalledWith('/incidents?entite=dsi', { scroll: false })
  })
})
