import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppetenceHistorique from '@/components/AppetenceHistorique'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const resume = (hors: number) => ({ global: 'ORANGE', appetit: { evalues: 10, horsAppetit: hors, seuilGlobal: 8, voyant: 'ORANGE' }, maturite: [], kri: { total: 3, alerte: 1, critique: 0, voyant: 'ORANGE' } })
const payload = (canWrite = true) => ({ canWrite, tendances: [{ periode: '2026-09', resume: resume(5), delta: null, sens: null }, { periode: '2026-10', resume: resume(2), delta: { horsAppetit: -3, kriAlerte: 0, kriCritique: 0, maturiteSousCible: 0 }, sens: 'AMELIORATION' }] })
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockImplementation(async (_u: string, init?: RequestInit) => ({ ok: true, status: init?.method === 'POST' ? 201 : 200, json: async () => (init?.method === 'POST' ? { periode: '2026-10' } : payload()) }) as Response) })

describe('AppetenceHistorique', () => {
  it('liste les mois (récent d’abord) avec la tendance et propose l’export Excel', async () => {
    render(<AppetenceHistorique />)
    const table = await screen.findByRole('table', { name: /Historique/ })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('2026-10'); expect(rows[0]).toHaveTextContent('Amélioration'); expect(rows[1]).toHaveTextContent('2026-09')
    expect(screen.getByRole('link', { name: /Exporter \(Excel\)/ }).getAttribute('href')).toContain('/api/appetence/historique?format=xlsx')
  })
  it('« Figer le mois » enregistre l’instantané (rôle d’écriture) puis recharge ; absent sans droit d’écriture', async () => {
    render(<AppetenceHistorique />)
    fireEvent.click(await screen.findByRole('button', { name: /Figer l’instantané du mois/ }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(true))
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => payload(false) }) as Response)
    const { unmount } = render(<AppetenceHistorique />)
    await waitFor(() => expect(screen.getAllByRole('table').length).toBeGreaterThan(0))
    unmount()
  })
  it('sans instantané : invite à figer le premier mois', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ canWrite: true, tendances: [] }) }) as Response)
    render(<AppetenceHistorique />)
    expect(await screen.findByText(/Aucun instantané/)).toBeInTheDocument()
  })
})
