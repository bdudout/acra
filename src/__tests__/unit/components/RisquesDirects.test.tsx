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
  suggestionsLabel: 'Suggestions pour votre secteur', suggestionsHint: 'Cliquez pour pré-remplir.',
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

  it('suggestion sectorielle : clic pré-remplit le formulaire puis POST avec les G/V suggérés', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [] }))
    const suggestions = [{ intitule: 'Arrêt du SIH par rançongiciel', gravite: 4, vraisemblance: 3, pertinent: true }]
    render(<RisquesDirects analyseId="an1" editable suggestions={suggestions} />)
    await screen.findByText('Aucun risque pour l\'instant.')

    // La puce est visible ; le clic pré-remplit l'intitulé (le formulaire, pas de création).
    fireEvent.click(screen.getByRole('button', { name: /Arrêt du SIH par rançongiciel/ }))
    expect((screen.getByPlaceholderText('Intitulé') as HTMLInputElement).value).toBe('Arrêt du SIH par rançongiciel')
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(false) // rien créé au clic

    fetchMock.mockReturnValueOnce(jsonOk({ risque: { id: 'r9' } }))
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [{ id: 'r9', nom: 'Arrêt du SIH par rançongiciel', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE' }] }))
    fireEvent.click(screen.getByText('Ajouter'))
    await waitFor(() => expect(screen.getByText('Arrêt du SIH par rançongiciel')).toBeInTheDocument())
    const postCall = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')
    expect(JSON.parse(postCall![1].body)).toMatchObject({ nom: 'Arrêt du SIH par rançongiciel', gravite: 4, vraisemblance: 3 })
  })

  it('lecture seule : les suggestions ne sont pas affichées', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [] }))
    render(<RisquesDirects analyseId="an1" editable={false} suggestions={[{ intitule: 'X', gravite: 2, vraisemblance: 2, pertinent: false }]} />)
    await screen.findByText('Aucun risque pour l\'instant.')
    expect(screen.queryByText('Suggestions pour votre secteur')).toBeNull()
  })
})
