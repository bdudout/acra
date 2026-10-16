/**
 * TachesPlanifiees — administration des traitements de fond (intégrité) : l'échec de la dernière
 * exécution est visible avec son erreur, la relance appelle l'API, les webhooks en échec sont remis en file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TachesPlanifiees from '@/components/TachesPlanifiees'

const etat = {
  taches: [
    { tache: 'relances', derniere: { statut: 'ECHEC', declencheur: 'CRON', debut: '2026-10-16T06:00:00Z', fin: '2026-10-16T06:00:01Z', dureeMs: 900, erreur: 'HTTP 500 : smtp_indisponible' }, dernierSucces: null, echecs7j: 3 },
    { tache: 'cleanup', derniere: null, dernierSucces: null, echecs7j: 0 },
  ],
  executions: [],
  webhooks: { enEchec: 2, enAttente: 0 },
  cronConfigure: true,
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init?: RequestInit) =>
    new Response(JSON.stringify(init?.method === 'POST' ? { ok: true, remis: 2 } : etat))))
})

describe('TachesPlanifiees', () => {
  it('affiche l\'échec de la dernière exécution avec son erreur et le nombre d\'échecs', async () => {
    render(<TachesPlanifiees />)
    expect(await screen.findByText(/smtp_indisponible/)).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('relance une tâche et remet les webhooks en échec en file', async () => {
    render(<TachesPlanifiees />)
    await screen.findByText(/smtp_indisponible/)
    const relancer = screen.getAllByRole('button')
    fireEvent.click(relancer[0])
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([, i]) => (i as RequestInit | undefined)?.body === JSON.stringify({ action: 'relancer', tache: 'relances' }))).toBe(true))
    await waitFor(() => expect(screen.getAllByRole('button').every(b => !(b as HTMLButtonElement).disabled)).toBe(true))
    fireEvent.click(screen.getAllByRole('button').at(-1)!)
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([, i]) => (i as RequestInit | undefined)?.body === JSON.stringify({ action: 'relancer-webhooks' }))).toBe(true))
  })
})
