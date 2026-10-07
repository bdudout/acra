// Programme d'audit et de contrôle (lots P2-P3) : liste et création des plans ; écran d'un plan (actions du cycle selon
// les droits, lignes verrouillées après validation d'un plan figé, graphique annuel).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlansManager from '@/components/plans/PlansManager'
import PlanView from '@/components/plans/PlanView'

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
    fireEvent.click(screen.getByRole('button', { name: 'Créer le plan' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Le nom du plan est requis.')
  })
})

describe('PlanView', () => {
  const PLAN = (statut: string, droits = { preparer: true, valider: false, doubleRegard: false }) => ({
    plan: { id: 'p1', type: 'AUDIT', nom: 'Audit SI', equipe: null, prismePrincipal: 'RISQUE', mode: 'FIGE', anneeDebut: 2027, anneeFin: 2027 },
    annees: [{ annee: 2027, statut, preparePar: 'u1', validePar: null, valideLe: statut === 'VALIDE' ? '2026-12-12T10:00:00Z' : null, commentaire: null, revision: 0, motifRevision: null, historique: [{ action: 'SOUMETTRE', statut: 'SOUMIS', par: 'u1', le: '2026-12-01T10:00:00Z' }] }],
    lignes: [{ id: 'l1', annee: 2027, intitule: 'Accès privilégiés', prisme: 'RISQUE', cibles: { risques: ['r1', 'r2'], organisations: ['f1'] }, echantillon: { methode: 'RISQUE', population: 40, taille: 8 }, debut: '2027-03-01T00:00:00.000Z', fin: '2027-04-15T00:00:00.000Z', charge: 12, priorite: 2, responsable: 'Équipe SI', statutManuel: null }],
    droits,
  })
  it('brouillon (préparateur) : soumettre, ajouter et modifier des lignes ; frise et cibles résumées', async () => {
    fetchMock.mockImplementation(async (u: string, init?: { method?: string }) => init?.method === 'PATCH' ? json({ ok: true }) : json(PLAN('BROUILLON')))
    render(<PlanView id="p1" />)
    expect(await screen.findByRole('heading', { name: 'Audit SI' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Soumettre pour validation' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ajouter une ligne' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Modifier Accès privilégiés' })).toBeTruthy()
    expect(screen.getByText(/Entités et filiales 1 · Risques 2/)).toBeTruthy()
    expect(within(screen.getByRole('figure')).getByText('Accès privilégiés')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre pour validation' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/plans/p1/annees/2027', expect.objectContaining({ method: 'PATCH' })))
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
