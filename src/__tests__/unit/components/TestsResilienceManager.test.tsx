import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TestsResilienceManager from '@/components/TestsResilienceManager'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
const ok = (b: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => b } as Response)
const liste = {
  annee: 2026, annees: [2026, 2025], canWrite: true,
  tests: [{ id: 't1', annee: 2026, intitule: 'Pentest portail', type: 'PENETRATION', statut: 'REALISE', fonctionCritique: true, independant: true, testeur: 'EXTERNE', perimetre: null, processusId: null, riskItemIds: [], datePrevue: null, dateRealisation: '2026-05-10T00:00:00.000Z', resultat: null, constats: [{ description: 'Injection SQL', severite: 4, corrige: false }] }],
  stats: { planifies: 1, realises: 1, tauxRealisation: 100, parType: {}, fonctionsCritiquesTestees: 1, nonIndependants: 0, constats: { total: 1, ouverts: 1, corriges: 0, ouvertsCritiques: 1 }, tlpt: { dernier: null, echeance: null, enRetard: false } },
}
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.startsWith('/api/risk-items')) return ok({ risks: [{ id: 'r1', intitule: 'Indisponibilité paiement' }] })
    if (init?.method === 'POST') return ok({ test: { id: 't2' } }, 201)
    return ok(liste)
  })
  vi.stubGlobal('fetch', fetchMock)
})

describe('TestsResilienceManager', () => {
  it('liste les tests de l’année avec type officiel, statut et indicateurs', async () => {
    render(<TestsResilienceManager />)
    const row = (await screen.findByText('Pentest portail')).closest('tr')!
    expect(within(row).getByText('Tests de pénétration')).toBeTruthy()
    expect(within(row).getByText('Réalisé')).toBeTruthy()
    expect(screen.getByText('100 %')).toBeTruthy()
    expect(screen.getByText('dont 1 de sévérité 4')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Rapport de réexamen (Word)' }).getAttribute('href')).toBe('/api/tests-resilience/rapport?annee=2026')
  })

  it('ajoute un test avec type, fonction critique, constat et risque lié', async () => {
    render(<TestsResilienceManager />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un test' }))
    fireEvent.change(screen.getByLabelText('Intitulé'), { target: { value: 'Test PCA' } })
    fireEvent.change(screen.getByLabelText('Type de test'), { target: { value: 'SCENARIO' } })
    fireEvent.click(screen.getByLabelText('Soutient une fonction critique ou importante'))
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un constat' }))
    fireEvent.change(screen.getByLabelText('Description du constat'), { target: { value: 'Bascule trop lente' } })
    fireEvent.click(await screen.findByLabelText('Indisponibilité paiement'))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(true))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'POST')![1].body)
    expect(body).toMatchObject({ annee: 2026, intitule: 'Test PCA', type: 'SCENARIO', fonctionCritique: true, riskItemIds: ['r1'], constats: [{ description: 'Bascule trop lente', severite: 2, corrige: false }] })
  })

  it('un exemple de test préremplit le formulaire (type officiel, périmètre, fonction critique)', async () => {
    render(<TestsResilienceManager />)
    expect(await screen.findByText('À quoi ça sert')).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un test' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Analyse de vulnérabilités du SI de paiement' }))
    expect((screen.getByLabelText('Intitulé') as HTMLInputElement).value).toBe('Analyse de vulnérabilités du SI de paiement')
    expect((screen.getByLabelText('Type de test') as HTMLSelectElement).value).toBe('VULNERABILITY')
    expect((screen.getByLabelText('Soutient une fonction critique ou importante') as HTMLInputElement).checked).toBe(true)
  })
})
