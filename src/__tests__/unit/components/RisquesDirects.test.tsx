import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import RisquesDirects from '@/components/RisquesDirects'

const M = {
  pageTitle: 'Appréciation', pageSubtitle: 'sous', title: 'Risques', subtitle: 'Ajoutez…',
  colNom: 'Risque', nomPlaceholder: 'Intitulé', colGravite: 'Gravité', colVraisemblance: 'Vraisemblance', abbrGravite: 'G', abbrVraisemblance: 'V', colProprietaire: 'Propriétaire', proprietairePlaceholder: 'Propriétaire du risque', filterOwnerAll: 'Tous', filterOwnerNone: 'Sans propriétaire', ownerMissing: 'Propriétaire non désigné', colNiveauEvalue: 'Niveau évalué (actuel)', colCritere: 'Critère', basisAppetit: 'Appétit : acceptable jusqu’à {seuil}', basisEchelle: 'Échelle : palier « {palier} »', evalHint: 'Évalué au niveau actuel.',
  colNiveau: 'Niveau', colStrategie: 'Traitement', add: 'Ajouter', empty: 'Aucun risque pour l\'instant.',
  niveauBrut: 'Brut', niveauActuel: 'Actuel', niveauResiduel: 'Résiduel', colResiduelCible: 'Résiduel (cible)', colActuelAvecMesures: 'Actuel (avec mesures)',
  delete: 'Supprimer', deleteConfirm: 'Supprimer ?', tier_faible: 'Faible', tier_modere: 'Modéré',
  tier_eleve: 'Élevé', tier_critique: 'Critique',
  strategies: { REDUIRE: 'Réduire', ACCEPTER: 'Accepter', TRANSFERER: 'Transférer', REFUSER: 'Refuser', SURVEILLER: 'Surveiller' },
  suggestionsLabel: 'Suggestions pour votre secteur', suggestionsHint: 'Cliquez pour ajouter.', undo: 'Annuler',
  colDecision: 'Décision', decisionTreat: 'À traiter', decisionAccept: 'Acceptable',
  prioSummary: '{treat} à traiter · {accept} acceptable(s)',
  subtitleReadonly: 'Consultez et priorisez vos risques (lecture seule).',
  manageTreatment: 'Gérer les mesures et plans d’action', manageMesures: 'Gérer les mesures de sécurité', managePlans: 'Gérer les plans d’action', treatmentCounts: '{mesures} mesures · {plans} plans', mesuresCount: '{count} mesures', plansCount: '{count} plans',
}
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ locale: 'fr', t: { risquesDirects: { ...fr.risquesDirects, ...M } } }) }
})

const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

const jsonOk = (body: unknown) => Promise.resolve({ ok: true, json: async () => body } as Response)

describe('RisquesDirects', () => {
  it('rend le traitement explicite et affiche ses compteurs', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [
      { id: 'r1', nom: 'Panne SI', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE', mesuresCount: 2, plansCount: 1 },
    ] }))
    render(<RisquesDirects analyseId="an1" editable />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gérer les mesures et plans d’action' })).toBeInTheDocument()
    expect(screen.getByText('2 mesures · 1 plans')).toBeInTheDocument()
  })

  it('affiche les risques chargés (nom + palier de niveau)', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [
      { id: 'r1', nom: 'Panne SI', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE' },
    ] }))
    render(<RisquesDirects analyseId="an1" editable />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    // Chaque étape affiche son niveau EN MOTS (palier de l'échelle) avec le score.
    expect(screen.getByRole('status', { name: 'Brut (sans mesure) : Critique (12)' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Actuel (mesures existantes) : Critique (12)' })).toBeInTheDocument()
  })

  it('3 niveaux : brut, actuel et résiduel ont chacun leur niveau en mots', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [
      { id: 'r1', nom: 'Rançongiciel', gravite: 4, vraisemblance: 3, niveauRisque: 12,
        graviteActuelle: 2, vraisemblanceActuelle: 3, niveauActuel: 6,
        graviteResiduelle: 1, vraisemblanceResiduelle: 3, niveauResiduel: 3, strategie: 'REDUIRE' },
    ] }))
    render(<RisquesDirects analyseId="an1" editable />)
    expect(await screen.findByText('Rançongiciel')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Brut (sans mesure) : Critique (12)' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Actuel (mesures existantes) : Modéré (6)' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Résiduel (cible) : Faible (3)' })).toBeInTheDocument()
  })

  it('éditeur « Actuel » (avec mesures) : modifier G met à jour graviteActuelle (PATCH)', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [
      { id: 'r1', nom: 'Panne SI', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE' },
    ] }))
    render(<RisquesDirects analyseId="an1" editable mode="rate" />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Actuel (mesures existantes)' })).toBeInTheDocument()
    // L'éditeur « Actuel » part des valeurs brutes ; on abaisse sa gravité à 2 (liste ciblée par son nom accessible).
    const gActuel = screen.getByRole('combobox', { name: 'Actuel (mesures existantes) — Gravité' }) as HTMLSelectElement
    expect(gActuel.value).toBe('4')
    fetchMock.mockReturnValueOnce(jsonOk({ risque: { id: 'r1', gravite: 4, vraisemblance: 3, niveauRisque: 12, graviteActuelle: 2, vraisemblanceActuelle: 3, niveauActuel: 6, strategie: 'REDUIRE' } }))
    fireEvent.change(gActuel, { target: { value: '2' } })
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')
      expect(patch && JSON.parse(patch[1].body)).toMatchObject({ graviteActuelle: 2 })
    })
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
    expect(screen.getByRole('columnheader', { name: 'Brut (sans mesure)' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Actuel (mesures existantes)' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Brut (sans mesure) — Gravité' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Brut (sans mesure) — Vraisemblance' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Traitement' })).toBeNull()
  })

  it('peut exposer uniquement les mesures pendant la phase d’analyse ISO 27005', async () => {
    fetchMock.mockReturnValueOnce(oneRow())
    render(<RisquesDirects analyseId="an1" editable mode="rate" treatmentSections="mesures" />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gérer les mesures de sécurité' })).toBeInTheDocument()
  })

  it('peut exposer uniquement les plans pendant la phase de traitement ISO 27005', async () => {
    fetchMock.mockReturnValueOnce(oneRow())
    render(<RisquesDirects analyseId="an1" editable mode="treat" treatmentSections="plans" />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gérer les plans d’action' })).toBeInTheDocument()
  })

  it('mode treat : pas d’ajout ; traitement éditable ; pas de cotation G/V', async () => {
    fetchMock.mockReturnValueOnce(oneRow())
    render(<RisquesDirects analyseId="an1" editable mode="treat" />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    expect(screen.queryByText('Ajouter')).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Traitement' })).toBeInTheDocument()
    // L'actuel est rappelé en lecture (point de départ du traitement), sans sélecteur.
    expect(screen.getByRole('columnheader', { name: 'Actuel (mesures existantes)' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Actuel (mesures existantes) — Gravité' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Brut (sans mesure) — Gravité' })).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Résiduel (cible) — Gravité' })).toBeInTheDocument()
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
    // Registre non vide : suggestions repliées d'office, on les déplie.
    fireEvent.click(screen.getByRole('button', { name: /Suggestions pour votre secteur/ }))
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

  it('P1 — échelle de l’organisation à 5 niveaux : 5 choix de gravité', async () => {
    fetchMock.mockReturnValueOnce(oneRow())
    render(<RisquesDirects analyseId="an1" editable mode="rate" scale={{ nbNiveaux: 5 }} />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    const g = screen.getByRole('combobox', { name: 'Brut (sans mesure) — Gravité' }) as HTMLSelectElement
    expect([...g.options].map(o => o.value)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('P2 — évaluation sur le niveau ACTUEL : brut critique mais actuel faible → acceptable', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [
      { id: 'r1', nom: 'Rançongiciel', gravite: 4, vraisemblance: 3, niveauRisque: 12, graviteActuelle: 1, vraisemblanceActuelle: 3, niveauActuel: 3, strategie: 'REDUIRE' },
    ] }))
    render(<RisquesDirects analyseId="an1" editable={false} mode="review" />)
    expect(await screen.findByText('Rançongiciel')).toBeInTheDocument()
    expect(screen.getByText(M.decisionAccept)).toBeInTheDocument()
    expect(screen.getByText(/Échelle : palier « Faible »/)).toBeInTheDocument()
  })

  it('P2 — l’appétit de l’organisation prime sur l’échelle et est cité comme critère', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [
      { id: 'r1', nom: 'Rançongiciel', gravite: 4, vraisemblance: 3, niveauRisque: 12, graviteActuelle: 1, vraisemblanceActuelle: 3, niveauActuel: 3, strategie: 'REDUIRE' },
    ] }))
    render(<RisquesDirects analyseId="an1" editable={false} mode="review" appetit={{ seuilGlobal: 2, parCategorie: {} }} />)
    expect(await screen.findByText('Rançongiciel')).toBeInTheDocument()
    expect(screen.getByText(M.decisionTreat)).toBeInTheDocument()
    expect(screen.getByText('Appétit : acceptable jusqu’à 2')).toBeInTheDocument()
  })

  it('P2 — écran complet (ISO 31000 / NIST) : la décision a sa colonne, en fin de ligne', async () => {
    fetchMock.mockReturnValueOnce(oneRow())
    render(<RisquesDirects analyseId="an1" editable />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    // Tableau des risques (les tableaux de la légende sont à part).
    const tables = screen.getAllByRole('table')
    const headers = within(tables[tables.length - 1]).getAllByRole('columnheader').map(h => h.textContent)
    expect(headers).toEqual(['Risque', 'Brut (sans mesure)', 'Actuel (mesures existantes)', 'Traitement', 'Résiduel (cible)', 'Décision', ''])
    expect(screen.getByText(M.decisionTreat)).toBeInTheDocument()
  })

  it('cotation lisible et contrôlée : libellés des niveaux, actuel borné par le brut, cascade à la baisse', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [
      { id: 'r1', nom: 'Panne SI', gravite: 3, vraisemblance: 3, niveauRisque: 9, graviteActuelle: 3, vraisemblanceActuelle: 2, graviteResiduelle: 2, vraisemblanceResiduelle: 2, strategie: 'REDUIRE', mesuresCount: 1 },
    ] }))
    render(<RisquesDirects analyseId="an1" editable />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    const gActuel = screen.getByRole('combobox', { name: 'Actuel (mesures existantes) — Gravité' }) as HTMLSelectElement
    expect([...gActuel.options].map(o => [o.textContent, o.disabled])).toEqual([['1 · Mineure', false], ['2 · Limitée', false], ['3 · Importante', false], ['4 · Critique', true]])
    fetchMock.mockReturnValueOnce(jsonOk({ risque: {} }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Brut (sans mesure) — Gravité' }), { target: { value: '1' } })
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')
      expect(patch && JSON.parse(patch[1].body)).toEqual({ gravite: 1, graviteActuelle: 1, graviteResiduelle: 1 })
    })
  })

  it('alertes de cohérence du traitement ; légende des échelles G/V dépliable', async () => {
    fetchMock.mockReturnValueOnce(oneRow())
    render(<RisquesDirects analyseId="an1" editable />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    expect(screen.getByText(/« Réduire » sans mesure ni plan d’action/)).toBeInTheDocument()
    expect(screen.getByText(/G = gravité · V = vraisemblance/)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /Gravité : ampleur des conséquences/ })).toBeInTheDocument()
    expect(screen.getAllByText(/survie financière menacée/).length).toBeGreaterThan(0)
  })

  it('cotation refusée par le serveur : message explicite', async () => {
    fetchMock.mockReturnValueOnce(oneRow())
    render(<RisquesDirects analyseId="an1" editable />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    fetchMock.mockReturnValueOnce(Promise.resolve({ ok: false, status: 400, json: async () => ({ error: 'cotation_incoherente' }) } as Response))
    fireEvent.change(screen.getByRole('combobox', { name: 'Résiduel (cible) — Gravité' }), { target: { value: '1' } })
    expect(await screen.findByRole('alert')).toHaveTextContent(/Cotation refusée/)
  })

  it('P3 — saisie du propriétaire (validée à la sortie du champ) → PATCH', async () => {
    fetchMock.mockReturnValueOnce(oneRow())
    render(<RisquesDirects analyseId="an1" editable ownerSuggestions={['DSI', 'Alice Martin']} />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    const input = screen.getByRole('combobox', { name: 'Propriétaire — Panne SI' }) as HTMLInputElement
    fetchMock.mockReturnValueOnce(jsonOk({ risque: { id: 'r1', proprietaire: 'DSI' } }))
    fireEvent.change(input, { target: { value: 'DSI' } })
    fireEvent.blur(input)
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')
      expect(patch && JSON.parse(patch[1].body)).toEqual({ proprietaire: 'DSI' })
    })
  })

  it('P3 — filtre « Sans propriétaire » et colonne propriétaire en évaluation', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [
      { id: 'r1', nom: 'Panne SI', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE', proprietaire: 'DSI' },
      { id: 'r2', nom: 'Fuite', gravite: 2, vraisemblance: 2, niveauRisque: 4, strategie: 'REDUIRE', proprietaire: null },
    ] }))
    render(<RisquesDirects analyseId="an1" editable={false} mode="review" />)
    expect(await screen.findByText('Panne SI')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Propriétaire' })).toBeInTheDocument()
    expect(screen.getByText('Propriétaire non désigné')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Propriétaire'), { target: { value: '__none__' } })
    expect(screen.queryByText('Panne SI')).toBeNull()
    expect(screen.getByText('Fuite')).toBeInTheDocument()
  })
})

describe('RisquesDirects — projet 360 : suppression soumise à validation', () => {
  const cyber = { id: 'r1', nom: 'Fuite de données', gravite: 3, vraisemblance: 2, niveauRisque: 6, strategie: 'REDUIRE', domaine: 'CYBER' }
  it('un analyste DEMANDE la suppression (envoyée au RSSI) ; le risque reste, marqué', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [cyber] }))
    render(<RisquesDirects analyseId="an1" editable withDomaine suppression={{ role: 'ANALYSTE', validationActive: true }} />)
    expect(await screen.findByText('Fuite de données')).toBeInTheDocument()
    fetchMock.mockReturnValueOnce(Promise.resolve({ ok: true, status: 202, json: async () => ({ pending: true, risque: { ...cyber, suppressionDemandeeLe: '2026-10-06T10:00:00Z' } }) } as Response))
    fireEvent.click(screen.getAllByRole('button', { name: 'Demander la suppression' })[0])
    expect(await screen.findByText('Demande de suppression envoyée, à valider par le RSSI.')).toBeInTheDocument()
    expect(screen.getByText('Suppression demandée — à valider par le RSSI')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Valider la suppression' })).toBeNull()
  })
  it('le RSSI voit « Valider la suppression » et « Refuser » sur une demande en attente', async () => {
    fetchMock.mockReturnValueOnce(jsonOk({ risques: [{ ...cyber, suppressionDemandeeLe: '2026-10-06T10:00:00Z' }] }))
    render(<RisquesDirects analyseId="an1" editable withDomaine suppression={{ role: 'RSSI', validationActive: true }} />)
    expect(await screen.findByRole('button', { name: 'Valider la suppression' })).toBeInTheDocument()
    fetchMock.mockReturnValueOnce(jsonOk({ risque: { ...cyber, suppressionDemandeeLe: null } }))
    fireEvent.click(screen.getByRole('button', { name: 'Refuser' }))
    await waitFor(() => expect(screen.queryByText(/Suppression demandée/)).toBeNull())
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')![1].body)).toEqual({ refuserSuppression: true })
  })
})
