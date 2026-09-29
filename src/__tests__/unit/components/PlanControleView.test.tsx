import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlanControleView from '@/components/PlanControleView'

vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const data = {
  active: true, annee: 2026,
  plan: {
    annee: 2026,
    lignes: [{ controleId: 'c1', occurrences: [
      { index: 0, debut: '2026-01-01', fin: '2026-01-31', statut: 'REALISEE' }, { index: 1, debut: '2026-02-01', fin: '2026-02-28', statut: 'EN_RETARD' },
      { index: 2, debut: '2026-03-01', fin: '2026-03-31', statut: 'EN_COURS' }, { index: 3, debut: '2026-04-01', fin: '2026-04-30', statut: 'A_VENIR' },
    ] }],
    synthese: { prevues: 4, echues: 2, realisees: 1, enRetard: 1, enCours: 1, tauxRealisation: 50 },
    parMois: Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, prevues: i < 4 ? 1 : 0, realisees: 0, enRetard: 0 })),
    charge: [{ responsable: 'Alice', parMois: [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 5], pics: [11] }],
  },
  controles: [{ id: 'c1', intitule: 'Revue des accès', periodicite: 'MENSUEL', responsable: 'Alice', niveau: 'N1', cle: true, modeControle: 'MANUEL' }],
}
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); fetchMock.mockImplementation(() => Promise.resolve({ ok: true, json: async () => data } as Response)); vi.stubGlobal('fetch', fetchMock) })

describe('PlanControleView', () => {
  it('synthèse, une pastille par occurrence (statut accessible), charge et pic', async () => {
    render(<PlanControleView />)
    expect(await screen.findByRole('heading', { name: 'Plan annuel des contrôles' })).toBeTruthy()
    expect(screen.getByText('50 %')).toBeTruthy()
    const ligne = screen.getByText('Revue des accès').closest('tr')!
    const pastilles = within(ligne).getAllByRole('img')
    expect(pastilles).toHaveLength(4)
    expect(pastilles[1].getAttribute('aria-label')).toMatch(/En retard/)
    expect(within(screen.getByRole('table', { name: 'Charge par responsable et par mois' })).getByText('Alice')).toBeTruthy()
    expect(screen.getByLabelText(/Pic de charge/)).toBeTruthy()
  })
  it('changer d’année recharge le plan', async () => {
    render(<PlanControleView />)
    await screen.findByRole('heading', { name: 'Plan annuel des contrôles' })
    fireEvent.change(screen.getByLabelText('Année'), { target: { value: '2025' } })
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]).includes('annee=2025'))).toBe(true))
  })
})
