// Cockpit de pilotage GRC — consolidation des entités : tableau « Par entité » (sous-entités cumulées, non rattaché),
// filtre par entité du référentiel transmis à la consolidation, avec la portée du filtre expliquée.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PilotageGrc from '@/components/PilotageGrc'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/components/NouvelleAnalyseMenu', () => ({ default: () => null }))
vi.mock('@/components/ProjetsSuivi', () => ({ default: () => null }))
vi.mock('@/components/HeatmapGridHtml', () => ({ default: () => null }))

const vide = { total: 0, eleve: 0, moyen: 0, faible: 0, nonCote: 0 }
const actions = { total: 0, faits: 0, enCours: 0, aFaire: 0, enRetard: 0, tauxAvancement: 0 }
const ROLLUP = {
  active: true, orgCount: 1, modules: { incidents: true, controles: false, audit: false, appetit: false, kri: false, reglementaire: false },
  consolide: {
    risques: { ...vide, total: 4 }, actions,
    incidents: { total: 1, ouverts: 1, perteNette: 800 },
    parEntite: {
      lignes: [
        { id: 'g', nom: 'Groupe', niveau: 0, risques: { ...vide, total: 3, eleve: 1 }, actionsEnRetard: 1, incidents: { total: 1, ouverts: 1, perteNette: 800 } },
        { id: 'dsi', nom: 'DSI', niveau: 1, risques: { ...vide, total: 2, eleve: 1 }, actionsEnRetard: 1, incidents: { total: 1, ouverts: 1, perteNette: 800 } },
      ],
      nonRattache: { risques: { ...vide, total: 1 }, actionsEnRetard: 0, incidents: { total: 0, ouverts: 0, perteNette: 0 } },
    },
  },
  parOrg: [],
}
const E = (id: string, nom: string, o = {}) => ({ id, nom, type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null, ...o })
const fetchMock = vi.fn()
const ok = (b: unknown) => Promise.resolve({ ok: true, json: async () => b })
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/grc/rollup')) return ok(ROLLUP)
    if (url === '/api/referentiel-entites') return ok({ entites: [E('g', 'Groupe'), E('dsi', 'DSI', { parentId: 'g' })] })
    if (url === '/api/taxonomie') return ok({ taxonomie: [] })
    if (url === '/api/processus') return ok({ processus: [] })
    if (url === '/api/risk-items') return ok({ risks: [] })
    return ok({})
  })
  vi.stubGlobal('fetch', fetchMock)
})

describe('PilotageGrc — par entité', () => {
  it('tableau par entité (indenté) avec la ligne « non rattaché »', async () => {
    render(<PilotageGrc />)
    const section = await screen.findByRole('region', { name: 'Par entité' })
    const lignes = within(section).getAllByRole('row').map(r => r.textContent)
    expect(lignes.some(t => t?.includes('Groupe') && t.includes('3') && t.includes('800'))).toBe(true)
    expect(lignes.some(t => t?.includes('DSI'))).toBe(true)
    expect(within(section).getByText('Non rattaché à une entité')).toBeTruthy()
  })
  it('filtre par entité : transmis à la consolidation (sous-entités incluses) ; portée expliquée', async () => {
    render(<PilotageGrc />)
    await screen.findByRole('region', { name: 'Par entité' })
    fireEvent.change(await screen.findByLabelText('Entité'), { target: { value: 'dsi' } })
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]).startsWith('/api/grc/rollup?') && String(c[0]).includes('entiteId=dsi'))).toBe(true))
    expect(await screen.findByText(/Filtre par entité : risques, actions et incidents/)).toBeTruthy()
  })
})
