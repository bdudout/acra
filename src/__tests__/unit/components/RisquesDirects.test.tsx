import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RisquesDirects from '@/components/RisquesDirects'

const M = {
  pageTitle: 'Appréciation', pageSubtitle: 'sous', title: 'Risques', subtitle: 'Ajoutez…',
  colNom: 'Risque', nomPlaceholder: 'Intitulé', colGravite: 'Gravité', colVraisemblance: 'Vraisemblance',
  colNiveau: 'Niveau', colStrategie: 'Traitement', add: 'Ajouter', empty: 'Aucun risque pour l\'instant.',
  delete: 'Supprimer', deleteConfirm: 'Supprimer ?', tier_faible: 'Faible', tier_modere: 'Modéré',
  tier_eleve: 'Élevé', tier_critique: 'Critique',
  strategies: { REDUIRE: 'Réduire', ACCEPTER: 'Accepter', TRANSFERER: 'Transférer', REFUSER: 'Refuser', SURVEILLER: 'Surveiller' },
}
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ locale: 'fr', t: { risquesDirects: M } }) }))

const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

const jsonOk = (body: unknown) => Promise.resolve({ ok: true, json: async () => body } as Response)

describe('RisquesDirects', () => {
  it('affiche les risques chargés (nom + palier de niveau)', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [
      { id: 'r1', nom: 'Panne SI', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE' },
    ] }))
    render(<RisquesDirects analyseId="an1" editable />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    // niveau 12 → palier critique (seuil ≥12)
    expect(screen.getByText(/12 · Critique/)).toBeInTheDocument()
  })

  it('état vide', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [] }))
    render(<RisquesDirects analyseId="an1" editable />)
    expect(await screen.findByText('Aucun risque pour l\'instant.')).toBeInTheDocument()
  })

  it('ajoute un risque (POST) puis recharge', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [] }))        // load initial
    render(<RisquesDirects analyseId="an1" editable />)
    await screen.findByText('Aucun risque pour l\'instant.')

    fireEvent.change(screen.getByPlaceholderText('Intitulé'), { target: { value: 'Fuite de données' } })
    fetchMock.mockReturnValueOnce(jsonOk({ risque: { id: 'r2' } }))                    // POST
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [{ id: 'r2', nom: 'Fuite de données', gravite: 2, vraisemblance: 2, niveauRisque: 4, strategie: 'REDUIRE' }] })) // reload
    fireEvent.click(screen.getByText('Ajouter'))

    await waitFor(() => expect(screen.getByText('Fuite de données')).toBeInTheDocument())
    // Vérifie l'appel POST avec le corps attendu.
    const postCall = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')
    expect(postCall?.[0]).toBe('/api/analyses/an1/risques')
    expect(JSON.parse(postCall![1].body)).toMatchObject({ nom: 'Fuite de données', gravite: 2, vraisemblance: 2 })
  })

  it('lecture seule : pas de bouton Ajouter', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [] }))
    render(<RisquesDirects analyseId="an1" editable={false} />)
    await screen.findByText('Aucun risque pour l\'instant.')
    expect(screen.queryByText('Ajouter')).toBeNull()
  })
})
