// File de double validation : approuver, rejeter (motif obligatoire), annuler sa propre demande, erreurs traduites.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DemandesValidation from '@/components/DemandesValidation'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const base = { statut: 'EN_ATTENTE', createdAt: '2026-11-03T08:00:00Z', decideLe: null, motifDecision: null, commentaire: null, valideur: null }
const demandes = [
  { ...base, id: 'd1', type: 'SUPPRESSION_CONTRAT_TIC', libelle: 'C-CRIT — Hébergeur', demandeur: 'Alice', peutDecider: true, peutAnnuler: false },
  { ...base, id: 'd2', type: 'ACCEPTATION_RISQUE_REGISTRE', libelle: 'Fraude au virement', demandeur: 'Moi', peutDecider: false, peutAnnuler: true },
]
const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => ({ ok: true, json: async () => (init?.method === 'POST' ? { ok: true } : { demandes, enAttente: 1 }) }))
  vi.stubGlobal('fetch', fetchMock)
})
const posts = () => fetchMock.mock.calls.filter(c => c[1]?.method === 'POST')

describe('DemandesValidation', () => {
  it('liste les demandes ; approuver envoie la décision', async () => {
    render(<DemandesValidation />)
    expect(await screen.findByText('Suppression d’un contrat TIC critique ou important — C-CRIT — Hébergeur')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Approuver et exécuter' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0][0]).toBe('/api/validations/d1')
    expect(JSON.parse(posts()[0][1].body)).toMatchObject({ decision: 'APPROUVER' })
    expect(await screen.findByRole('status')).toHaveTextContent('l’action a été exécutée')
  })
  it('rejeter exige un motif', async () => {
    render(<DemandesValidation />)
    const rejeter = await screen.findByRole('button', { name: 'Rejeter' })
    expect(rejeter).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Motif (obligatoire pour rejeter) — C-CRIT — Hébergeur'), { target: { value: 'Contrat encore utilisé' } })
    fireEvent.click(rejeter)
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(JSON.parse(posts()[0][1].body)).toEqual({ decision: 'REJETER', motif: 'Contrat encore utilisé' })
  })
  it('le demandeur annule sa demande ; erreur serveur traduite', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => (init?.method === 'POST' ? { ok: false, json: async () => ({ error: 'demande_close' }) } : { ok: true, json: async () => ({ demandes, enAttente: 1 }) }))
    render(<DemandesValidation />)
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler ma demande' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette demande a déjà été tranchée.')
  })
})
