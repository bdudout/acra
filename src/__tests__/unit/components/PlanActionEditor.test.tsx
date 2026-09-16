import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PlanActionEditor from '@/components/PlanActionEditor'

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    t: { plansActions: {
      colTitre: 'Action', colPorteur: 'Porteur', colEcheance: 'Échéance', colPriorite: 'Priorité', colStatut: 'Statut',
      priorites: { CRITIQUE: 'Critique', MAJEUR: 'Majeure', MODERE: 'Modérée' },
      statuts: { A_FAIRE: 'À faire', EN_COURS: 'En cours', FAIT: 'Fait' },
      save: 'Enregistrer', clear: 'Annuler', editError: 'Échec',
    } },
  }),
}))

describe('PlanActionEditor', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('édite un plan d\'action → PATCH plans-actions avec les champs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const onSaved = vi.fn()
    render(<PlanActionEditor orgId="o1"
      action={{ id: 'p1', titre: 'Ancien', porteur: 'DSI', echeance: null, priorite: 'MAJEUR', statut: 'A_FAIRE' }}
      onSaved={onSaved} onCancel={() => {}} />)
    fireEvent.change(screen.getByDisplayValue('Ancien'), { target: { value: 'Nouveau titre' } })
    fireEvent.click(screen.getByText('Enregistrer'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/organizations/o1/plans-actions/p1')
    expect(opts.method).toBe('PATCH')
    expect(JSON.parse(opts.body)).toMatchObject({ titre: 'Nouveau titre', porteur: 'DSI', priorite: 'MAJEUR', statut: 'A_FAIRE' })
  })

  it('titre vide → pas d\'appel', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<PlanActionEditor orgId="o1"
      action={{ id: 'p1', titre: '', porteur: null, echeance: null, priorite: 'MAJEUR', statut: 'A_FAIRE' }}
      onSaved={() => {}} onCancel={() => {}} />)
    fireEvent.click(screen.getByText('Enregistrer'))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
