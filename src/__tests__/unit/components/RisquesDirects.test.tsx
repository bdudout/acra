import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RisquesDirects from '@/components/RisquesDirects'

const M = {
  pageTitle: 'Appréciation', pageSubtitle: 'sous', title: 'Risques', subtitle: 'Ajoutez…',
  colNom: 'Risque', nomPlaceholder: 'Intitulé', colGravite: 'Gravité', colVraisemblance: 'Vraisemblance',
  colNiveau: 'Niveau', colStrategie: 'Traitement', add: 'Ajouter', empty: 'Aucun risque pour l\'instant.',
  niveauBrut: 'Brut', niveauActuel: 'Actuel', niveauResiduel: 'Résiduel', colResiduelCible: 'Résiduel (cible)',
  delete: 'Supprimer', deleteConfirm: 'Supprimer ?', tier_faible: 'Faible', tier_modere: 'Modéré',
  tier_eleve: 'Élevé', tier_critique: 'Critique',
  strategies: { REDUIRE: 'Réduire', ACCEPTER: 'Accepter', TRANSFERER: 'Transférer', REFUSER: 'Refuser', SURVEILLER: 'Surveiller' },
  suggestionsLabel: 'Suggestions pour votre secteur', suggestionsHint: 'Cliquez pour ajouter.', undo: 'Annuler',
  colDecision: 'Décision', decisionTreat: 'À traiter', decisionAccept: 'Acceptable',
  prioSummary: '{treat} à traiter · {accept} acceptable(s)',
  subtitleReadonly: 'Consultez et priorisez vos risques (lecture seule).',
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
    // niveau brut affiché (badge « Brut 12 ») ; actuel/résiduel masqués car non réduits.
    expect(screen.getByText('Brut')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.queryByText('Actuel')).toBeNull()
  })

  it('3 niveaux : affiche Brut, puis Actuel/Résiduel seulement s\'ils sont réduits', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [
      { id: 'r1', nom: 'Rançongiciel', gravite: 4, vraisemblance: 3, niveauRisque: 12,
        graviteActuelle: 2, vraisemblanceActuelle: 3, niveauActuel: 6,
        graviteResiduelle: 1, vraisemblanceResiduelle: 3, niveauResiduel: 3, strategie: 'REDUIRE' },
    ] }))
    render(<RisquesDirects analyseId="an1" editable />)
    expect(await screen.findByText('Rançongiciel')).toBeInTheDocument()
    expect(screen.getByText('Brut')).toBeInTheDocument()
    expect(screen.getByText('Actuel')).toBeInTheDocument()   // 6 < 12 → affiché
    expect(screen.getByText('Résiduel')).toBeInTheDocument() // 3 < 6 → affiché
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

  it('suggestion : le clic AJOUTE directement le risque (POST) + surlignage « Annuler » (undo)', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [] })) // chargement initial
    const suggestions = [{ intitule: 'Arrêt du SIH par rançongiciel', gravite: 4, vraisemblance: 3, pertinent: true }]
    render(<RisquesDirects analyseId="an1" editable suggestions={suggestions} />)
    await screen.findByText('Aucun risque pour l\'instant.')

    // Le clic sur la puce crée le risque directement (POST), sans passer par le formulaire.
    fetchMock.mockReturnValueOnce(jsonOk({ risque: { id: 'r9' } }))               // POST
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [{ id: 'r9', nom: 'Arrêt du SIH par rançongiciel', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE' }] })) // reload
    fireEvent.click(screen.getByRole('button', { name: /Arrêt du SIH par rançongiciel/ }))
    await waitFor(() => expect(screen.getByText('Arrêt du SIH par rançongiciel')).toBeInTheDocument())
    const postCall = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')
    expect(postCall?.[0]).toBe('/api/analyses/an1/risques')
    expect(JSON.parse(postCall![1].body)).toMatchObject({ nom: 'Arrêt du SIH par rançongiciel', gravite: 4, vraisemblance: 3 })

    // Undo : « Annuler » retire immédiatement le risque du registre (retrait optimiste
    // + DELETE). Le registre redevient vide (la puce de suggestion, elle, réapparaît).
    const undo = await screen.findByText('Annuler')
    fetchMock.mockReturnValueOnce(jsonOk({ ok: true }))                            // DELETE
    fireEvent.click(undo)
    await waitFor(() => expect(screen.getByText('Aucun risque pour l\'instant.')).toBeInTheDocument())
    expect(screen.queryByText('Annuler')).toBeNull() // plus de ligne surlignée
    const delCall = fetchMock.mock.calls.find(c => c[1]?.method === 'DELETE')
    expect(delCall?.[0]).toBe('/api/analyses/an1/risques/r9')
  })

  it('lecture seule : les suggestions ne sont pas affichées', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [] }))
    render(<RisquesDirects analyseId="an1" editable={false} suggestions={[{ intitule: 'X', gravite: 2, vraisemblance: 2, pertinent: false }]} />)
    await screen.findByText('Aucun risque pour l\'instant.')
    expect(screen.queryByText('Suggestions pour votre secteur')).toBeNull()
  })

  const oneRow = () => jsonOk({ risques: [{ id: 'r1', nom: 'Panne SI', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE' }] })

  it('mode identify : formulaire d’ajout sans cotation, table réduite (pas de niveau ni traitement)', async () => {
    fetchMock.mockReturnValueOnce(oneRow())
    render(<RisquesDirects analyseId="an1" editable mode="identify" />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    // Ajout présent, mais pas de sélecteurs de cotation dans l’en-tête.
    expect(screen.getByText('Ajouter')).toBeInTheDocument()
    expect(screen.queryByText('Niveau')).toBeNull()
    expect(screen.queryByText('Traitement')).toBeNull()
    // Pas de colonne Gravité (cotation) en identification.
    expect(screen.queryByText('Gravité')).toBeNull()
  })

  it('mode rate : pas d’ajout ; cotation G/V éditable ; pas de traitement', async () => {
    fetchMock.mockReturnValueOnce(oneRow())
    render(<RisquesDirects analyseId="an1" editable mode="rate" />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    expect(screen.queryByText('Ajouter')).toBeNull()
    expect(screen.getByText('Niveau')).toBeInTheDocument()
    expect(screen.getAllByText('Gravité').length).toBeGreaterThan(0)
    expect(screen.queryByText('Traitement')).toBeNull()
  })

  it('mode treat : pas d’ajout ; traitement éditable ; pas de cotation G/V', async () => {
    fetchMock.mockReturnValueOnce(oneRow())
    render(<RisquesDirects analyseId="an1" editable mode="treat" />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    expect(screen.queryByText('Ajouter')).toBeNull()
    expect(screen.getByText('Traitement')).toBeInTheDocument()
    expect(screen.getByText('Niveau')).toBeInTheDocument()
    expect(screen.queryByText('Gravité')).toBeNull()
  })

  it('#5 — masque les suggestions déjà présentes dans le registre', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [
      { id: 'r1', nom: 'Panne SI', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE' },
    ] }))
    const suggestions = [
      { intitule: 'Panne SI', gravite: 4, vraisemblance: 3, pertinent: true },        // déjà présent → masqué
      { intitule: 'Fuite de données', gravite: 3, vraisemblance: 2, pertinent: true }, // absent → affiché
    ]
    render(<RisquesDirects analyseId="an1" editable suggestions={suggestions} />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument() // ligne du registre
    // La suggestion « Fuite de données » est proposée ; « Panne SI » ne l'est pas (déjà ajoutée).
    expect(screen.getByRole('button', { name: /Fuite de données/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Panne SI/ })).toBeNull()
  })

  it('#7 — lecture seule : sous-titre dédié (pas « Ajoutez… »)', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [] }))
    render(<RisquesDirects analyseId="an1" editable={false} />)
    await screen.findByText('Aucun risque pour l\'instant.')
    expect(screen.getByText('Consultez et priorisez vos risques (lecture seule).')).toBeInTheDocument()
    expect(screen.queryByText('Ajoutez…')).toBeNull()
  })

  it('mode review : priorisation lecture seule + décision d’acceptation + résumé', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [
      { id: 'a', nom: 'Risque faible', gravite: 2, vraisemblance: 2, niveauRisque: 4, strategie: 'ACCEPTER' },
      { id: 'b', nom: 'Risque critique', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE' },
    ] }))
    render(<RisquesDirects analyseId="an1" editable={false} mode="review" />)
    expect(await screen.findByText('Risque critique')).toBeInTheDocument()
    // Colonne décision + badges dérivés du niveau.
    expect(screen.getByText('Décision')).toBeInTheDocument()
    expect(screen.getByText('À traiter')).toBeInTheDocument()
    expect(screen.getByText('Acceptable')).toBeInTheDocument()
    // Résumé (1 à traiter, 1 acceptable) + priorisation (critique avant faible).
    expect(screen.getByText('1 à traiter · 1 acceptable(s)')).toBeInTheDocument()
    const noms = screen.getAllByText(/Risque (critique|faible)/).map(n => n.textContent)
    expect(noms).toEqual(['Risque critique', 'Risque faible'])
    // Lecture seule : pas d’ajout, pas de sélecteur de traitement.
    expect(screen.queryByText('Ajouter')).toBeNull()
    expect(screen.queryByText('Traitement')).toBeNull()
  })
})
