import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RegistreIaManager from '@/components/RegistreIaManager'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('confirm', () => true) })

const systeme = { id: 's1', nom: 'Présélection des candidatures', finalite: 'Classer', fournisseur: null, donnees: ['CV'], categoriesParticulieres: false, typeDecision: 'AIDE', interventionHumaine: 'Revue', usage: 'RECRUTEMENT', controlesBiais: null, derniereRevue: null, analyseId: null, aipdReference: null, statut: 'EN_PROJET', classe: 'HAUT_RISQUE_PROBABLE', revueEnRetard: true, manquants: ['fournisseur', 'controlesBiais'] }
const registre = { canManage: true, systemes: [systeme], analyses: [{ id: 'a1', nom: 'Analyse RH' }], synthese: { total: 1, hautRisque: 1, revuesEnRetard: 1, aCompleter: 1 } }
const catalogue = { items: [
  { key: 'ia.tri-cv', nom: 'Présélection des candidatures', usage: 'RECRUTEMENT', typeDecision: 'AIDE', classe: 'HAUT_RISQUE_PROBABLE', status: 'ALREADY_IMPORTED' },
  { key: 'ia.assistant-generatif', nom: 'Assistant d’IA générative pour les collaborateurs', usage: 'IA_GENERATIVE', typeDecision: 'AIDE', classe: 'RISQUE_LIMITE', status: 'NEW' },
] }

function route(url: string, init?: RequestInit) {
  if (url.startsWith('/api/registre-ia/catalogue')) return init?.method === 'POST' ? { ok: true, json: async () => ({ created: ['ia.assistant-generatif'] }) } : { ok: true, json: async () => catalogue }
  if (url === '/api/registre-ia' && init?.method === 'POST') return { ok: true, json: async () => ({ id: 's2' }) }
  if (url.startsWith('/api/registre-ia/s1')) return { ok: true, json: async () => ({ ok: true }) }
  return { ok: true, json: async () => registre }
}

describe('RegistreIaManager', () => {
  it('liste : classement indicatif, revue en retard, champs à compléter, avertissement réglementaire', async () => {
    fetchMock.mockImplementation((u: string, i?: RequestInit) => Promise.resolve(route(u, i)))
    render(<RegistreIaManager />)
    const ligne = (await screen.findByText('Présélection des candidatures')).closest('tr')!
    expect(within(ligne).getByText('Haut risque probable (annexe III)')).toBeTruthy()
    expect(within(ligne).getByText('jamais revue')).toBeTruthy()
    expect(within(ligne).getByText(/À compléter : fournisseur, contrôles des biais/)).toBeTruthy()
    expect(screen.getByText(/règlement \(UE\) 2024\/1689/)).toBeTruthy()
  })
  it('import des systèmes types : déjà importé non sélectionnable, import des nouveaux', async () => {
    fetchMock.mockImplementation((u: string, i?: RequestInit) => Promise.resolve(route(u, i)))
    render(<RegistreIaManager />)
    fireEvent.click(await screen.findByRole('button', { name: 'Importer des systèmes types' }))
    const deja = await screen.findByRole('checkbox', { name: /Présélection des candidatures/ })
    expect((deja as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Importer 1 système(s)' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[0] === '/api/registre-ia/catalogue' && c[1]?.method === 'POST')).toBe(true))
    const post = fetchMock.mock.calls.find(c => c[0] === '/api/registre-ia/catalogue' && c[1]?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toEqual({ keys: ['ia.assistant-generatif'], locale: 'fr' })
    expect(await screen.findByText('1 système(s) importé(s)')).toBeTruthy()
  })
  it('ajout d’un système : formulaire, données une par ligne, analyse liée', async () => {
    fetchMock.mockImplementation((u: string, i?: RequestInit) => Promise.resolve(route(u, i)))
    render(<RegistreIaManager />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un système' }))
    fireEvent.change(screen.getByLabelText('Nom du système'), { target: { value: 'Score de churn' } })
    fireEvent.change(screen.getByLabelText('Données utilisées (une par ligne)'), { target: { value: 'Historique\nContrats' } })
    fireEvent.change(screen.getByLabelText('Analyse de risques liée'), { target: { value: 'a1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[0] === '/api/registre-ia' && c[1]?.method === 'POST')).toBe(true))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[0] === '/api/registre-ia' && c[1]?.method === 'POST')![1].body)
    expect(body).toMatchObject({ nom: 'Score de churn', donnees: ['Historique', 'Contrats'], analyseId: 'a1' })
  })
  it('suppression après confirmation', async () => {
    fetchMock.mockImplementation((u: string, i?: RequestInit) => Promise.resolve(route(u, i)))
    render(<RegistreIaManager />)
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer — Présélection des candidatures' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[0] === '/api/registre-ia/s1' && c[1]?.method === 'DELETE')).toBe(true))
  })
  it('lecture seule (contrôle, audit) : ni import, ni ajout, ni modification, ni suppression', async () => {
    fetchMock.mockImplementation((u: string, i?: RequestInit) => Promise.resolve(u === '/api/registre-ia' && !i?.method ? { ok: true, json: async () => ({ ...registre, canManage: false }) } : route(u, i)))
    render(<RegistreIaManager />)
    await screen.findByText('Présélection des candidatures')
    expect(screen.queryByRole('button', { name: 'Importer des systèmes types' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ajouter un système' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Modifier —|Supprimer —/ })).toBeNull()
  })
})
