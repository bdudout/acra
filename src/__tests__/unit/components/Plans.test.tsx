// Programme d'audit et de contrôle (lots P2-P3) : liste et création des plans ; écran d'un plan (actions du cycle selon
// les droits, lignes verrouillées après validation d'un plan figé, graphique annuel).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlansManager from '@/components/plans/PlansManager'
import PlanView from '@/components/plans/PlanView'
import VueGlobale from '@/components/plans/VueGlobale'
import RealisationsPanel from '@/components/plans/RealisationsPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body })
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('PlansManager', () => {
  const LISTE = { modules: { AUDIT: true, CONTROLE: true }, peutCreer: { AUDIT: true, CONTROLE: false }, modeDefaut: 'DYNAMIQUE', plans: [
    { id: 'p1', type: 'AUDIT', nom: 'Audit SI', equipe: 'Audit SI', prismePrincipal: 'REFERENTIEL', mode: 'FIGE', anneeDebut: 2027, anneeFin: 2028, annees: [{ annee: 2027, statut: 'VALIDE' }, { annee: 2028, statut: 'BROUILLON' }], _count: { lignes: 4 } },
  ] }
  it('plans par type avec le statut de chaque année ; création réservée au type autorisé, mode par défaut repris', async () => {
    fetchMock.mockImplementation(async (_u: string, init?: { method?: string }) => init?.method === 'POST' ? json({ error: 'nom_requis' }, false) : json(LISTE))
    render(<PlansManager />)
    expect(await screen.findByRole('link', { name: 'Audit SI' })).toHaveAttribute('href', '/plans/p1')
    expect(screen.getByText('2027 · Validé')).toBeTruthy()
    expect(screen.getByText('Aucun plan pour le moment.')).toBeTruthy() // aucun plan de contrôle
    expect(screen.queryByRole('button', { name: /Nouveau plan de contrôle/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Nouveau plan d’audit/ }))
    expect((screen.getByLabelText('Mode') as HTMLSelectElement).value).toBe('DYNAMIQUE')
    // Le choix du mode est expliqué sur le formulaire (verrouillage après validation).
    expect(screen.getByText(/Figé convient à une organisation qui fait approuver son plan par un comité/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Créer le plan' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Le nom du plan est requis.')
  })
})

describe('PlanView', () => {
  const PLAN = (statut: string, droits = { preparer: true, valider: false, doubleRegard: false }) => ({
    plan: { id: 'p1', type: 'AUDIT', nom: 'Audit SI', equipe: null, prismePrincipal: 'RISQUE', mode: 'FIGE', anneeDebut: 2027, anneeFin: 2027 },
    annees: [{ annee: 2027, statut, preparePar: 'u1', validePar: null, valideLe: statut === 'VALIDE' ? '2026-12-12T10:00:00Z' : null, commentaire: null, revision: 0, motifRevision: null, historique: [{ action: 'SOUMETTRE', statut: 'SOUMIS', par: 'u1', le: '2026-12-01T10:00:00Z' }] }],
    lignes: [{ id: 'l1', annee: 2027, intitule: 'Accès privilégiés', prisme: 'RISQUE', cibles: { risques: ['r1', 'r2'], organisations: ['f1'], entites: ['e1'] }, echantillon: { methode: 'RISQUE', population: 40, taille: 8 }, debut: '2027-03-01T00:00:00.000Z', fin: '2027-04-15T00:00:00.000Z', charge: 12, priorite: 2, responsable: 'Équipe SI', statutManuel: null }],
    droits,
  })
  it('brouillon (préparateur) : soumettre, ajouter et modifier des lignes ; frise et cibles résumées', async () => {
    fetchMock.mockImplementation(async (u: string, init?: { method?: string }) => init?.method === 'PATCH' ? json({ ok: true }) : json(PLAN('BROUILLON')))
    render(<PlanView id="p1" />)
    expect(await screen.findByRole('heading', { name: 'Audit SI' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Soumettre pour validation' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ajouter une ligne' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Modifier Accès privilégiés' })).toBeTruthy()
    expect(screen.getByText(/Filiales \(organisations\) 1 · Entités du référentiel 1 · Risques 2/)).toBeTruthy()
    expect(within(screen.getByRole('figure')).getByText('Accès privilégiés')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre pour validation' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/plans/p1/annees/2027', expect.objectContaining({ method: 'PATCH' })))
  })
  it('année soumise : lignes non modifiables, message « en attente de validation » (et non « année validée »)', async () => {
    fetchMock.mockResolvedValue(json(PLAN('SOUMIS')))
    render(<PlanView id="p1" />)
    expect(await screen.findByText(/Plan soumis : en attente de validation/)).toBeTruthy()
    expect(screen.queryByText(/Année validée/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ajouter une ligne' })).toBeNull()
  })
  it('année validée d’un plan figé : lignes verrouillées, seule la révision est proposée', async () => {
    fetchMock.mockResolvedValue(json(PLAN('VALIDE')))
    render(<PlanView id="p1" />)
    expect(await screen.findByText(/Validé le/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Réviser' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ajouter une ligne' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Modifier Accès privilégiés' })).toBeNull()
    expect(screen.getByText(/les lignes sont figées/)).toBeTruthy()
  })
  it('validateur sur un plan soumis : valider ou renvoyer ; refus du serveur affiché', async () => {
    fetchMock.mockImplementation(async (_u: string, init?: { method?: string }) => init?.method === 'PATCH' ? json({ error: 'double_regard' }, false) : json(PLAN('SOUMIS', { preparer: false, valider: true, doubleRegard: true })))
    vi.stubGlobal('prompt', () => '')
    render(<PlanView id="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }))
    expect(screen.getByRole('button', { name: 'Renvoyer au préparateur' })).toBeTruthy()
    expect(await screen.findByRole('alert')).toHaveTextContent('Double regard')
  })
})

describe('VueGlobale', () => {
  it('synthèse, sollicitations multiples (en même temps signalé), angles morts avec dernière couverture et « prévu »', async () => {
    fetchMock.mockResolvedValue(json({
      annee: 2027, seuilAnglesMortsAns: 3,
      plans: [{ id: 'p1', nom: 'Audit SI', type: 'AUDIT', equipe: null, statut: 'VALIDE', lignes: 2, annulees: 0, reportees: 1 }],
      lignes: [{ ligneId: 'l1', planId: 'p1', planNom: 'Audit SI', type: 'AUDIT', intitule: 'Accès', debut: '2027-03-01', fin: '2027-03-31', statutManuel: null, cibles: {} }],
      sollicitations: { organisations: [{ id: 'f1', nom: 'Filiale Nord', nombre: 2, plans: 2, simultanee: true, lignes: [{ ligneId: 'l1', planNom: 'Audit SI', intitule: 'Accès', debut: '2027-03-01', fin: '2027-03-31' }] }], tiers: [],
        entites: [{ id: 'dsi', nom: 'Direction des SI', nombre: 3, plans: 2, simultanee: false, lignes: [] }] },
      anglesMorts: { risques: [{ id: 'r1', nom: 'Fraude au virement', niveau: 12, derniere: null, prevu: true }], processus: [{ id: 'pr1', nom: 'Paie', criticite: 4, criticiteDora: 'CRITIQUE', derniere: '2022-05-01', prevu: false }] },
    }))
    render(<VueGlobale />)
    expect(await screen.findByRole('link', { name: 'Audit SI' })).toBeTruthy()
    expect(screen.getByText('1 reportée(s), 0 annulée(s)')).toBeTruthy()
    expect(screen.getByText(/Filiale Nord/)).toBeTruthy()
    expect(screen.getByText('En même temps')).toBeTruthy()
    // Entités du référentiel (consolidation, lot E5) : sollicitations agrégées par entité.
    expect(screen.getByText('Entités du référentiel')).toBeTruthy()
    expect(screen.getByText(/Direction des SI/)).toBeTruthy()
    expect(screen.getByText(/Angles morts : non audités ni contrôlés depuis 3 ans/)).toBeTruthy()
    expect(screen.getByText('Fraude au virement')).toBeTruthy()
    expect(screen.getByText('Dernière couverture : jamais')).toBeTruthy()
    expect(screen.getByText('Prévu')).toBeTruthy()
    expect(screen.getByText('DORA : critique')).toBeTruthy()
  })
})

describe('RealisationsPanel', () => {
  it('propositions cochées si déjà rattachées, recherche parmi les autres, enregistrement des rattachements', async () => {
    fetchMock.mockImplementation(async (_u: string, init?: { method?: string }) => init?.method === 'PUT' ? json({ ok: true }) : json({
      peutModifier: true,
      rattachees: [{ type: 'MISSION', id: 'm1' }],
      propositions: [{ type: 'MISSION', id: 'm1', intitule: 'Audit paie', processus: ['p1'], risques: [], debut: '2027-03-05', fin: null }],
      candidats: [
        { type: 'MISSION', id: 'm1', intitule: 'Audit paie', processus: ['p1'], risques: [], debut: '2027-03-05', fin: null },
        { type: 'CONTROLE', id: 'c1', intitule: 'Revue des accès', processus: [], risques: [], debut: '2027-01-01', fin: '2027-12-31' },
      ],
    }))
    const fermer = vi.fn()
    render(<RealisationsPanel planId="p1" ligneId="l1" onClose={fermer} />)
    expect(await screen.findByRole('checkbox', { name: 'Mission d’audit : Audit paie' })).toBeChecked()
    fireEvent.change(screen.getByPlaceholderText('Rechercher…'), { target: { value: 'accès' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Contrôle : Revue des accès' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fermer).toHaveBeenCalledWith(true))
    const put = fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')!
    expect(JSON.parse(put[1].body).realisations).toEqual([{ type: 'MISSION', id: 'm1' }, { type: 'CONTROLE', id: 'c1' }])
  })
})
