// Vue des dépendances des fonctions critiques ou importantes : synthèse, concentration, écarts libellés.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DependancesCritiques from '@/components/DependancesCritiques'
import { analyserDependances } from '@/lib/dependances-critiques'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
const u = (id: string) => ({ id, useCase: 'Paiement', tiersId: 't1', tiersNom: 'PSP', offre: 'Passerelle', criticite: 'CRITIQUE', couvert: id !== 'u2', evalue: true, exposeInternet: false, perimetrePci: true, avecSi: true, interconnexion: 'LIGNE_SPECIALISEE', hotes: ['api.psp.example'], contratSansSortie: false })
const donnees = analyserDependances([
  { id: 'p1', nom: 'Paiements', criticiteDora: 'CRITIQUE', proprietaire: 'DP', rtoMinutes: 480, rpoMinutes: 15, toleranceImpactMinutes: 240, nbControles: 1, nbRisques: 2, nbIncidents12m: 0, usages: [u('u1')], dernierTest: { dureeRepriseMinutes: 600, date: '2026-09-01' }, scenarios: [{ id: 's1', intitule: 'Rançongiciel', dureeInterruptionMinutes: 2880 }] },
  { id: 'p2', nom: 'Virements', criticiteDora: 'IMPORTANTE', proprietaire: 'DV', rtoMinutes: 60, rpoMinutes: 15, toleranceImpactMinutes: 240, nbControles: 1, nbRisques: 0, nbIncidents12m: 1, usages: [u('u2')], dernierTest: null, scenarios: [] },
])

describe('DependancesCritiques', () => {
  it('synthèse, concentration et écarts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(donnees)) })))
    render(<DependancesCritiques />)
    expect(await screen.findByTestId('synthese-dependances')).toHaveTextContent('2 fonction(s) critique(s) ou importante(s) · 2 avec des écarts · 4 écart(s) majeur(s)')
    expect(screen.getByText('PSP soutient plusieurs fonctions : Paiements, Virements')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Écarts — Paiements' })).getByText('RTO au-delà de la tolérance')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Écarts — Virements' })).getByText('Service sans contrat — PSP')).toBeInTheDocument()
    expect(screen.getAllByText(/RTO 8 h · RPO 15 min · tolérance 4 h/)).toHaveLength(1)
  })
  it('scénarios, dernier test, et ajout d’un scénario (droit de modification)', async () => {
    const fetchMock = vi.fn(async (_u: string, init?: RequestInit) => ({ ok: true, json: async () => (init?.method === 'POST' ? {} : { ...JSON.parse(JSON.stringify(donnees)), peutModifier: true, scenariosDetail: { s1: { description: null, mesures: 'Sauvegardes immuables', dateEvaluation: null } } }) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<DependancesCritiques />)
    const sc = await screen.findByRole('list', { name: 'Scénarios sévères mais plausibles — Paiements' })
    expect(within(sc).getByText('au-delà de la tolérance')).toBeInTheDocument()
    expect(screen.getByText(/Dernier test réalisé : 2026-09-01 \(reprise constatée : 10 h\)/)).toBeInTheDocument()
    expect(screen.getByText('Aucun test de résilience réalisé sur 12 mois')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Scénario — Virements'), { target: { value: 'Panne du PSP' } })
    fireEvent.change(screen.getByLabelText('Interruption estimée (h) — Virements'), { target: { value: '6' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Ajouter le scénario' })[1])
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(true))
    expect(JSON.parse(String(fetchMock.mock.calls.find(c => c[1]?.method === 'POST')![1]!.body))).toEqual({ processusId: 'p2', intitule: 'Panne du PSP', dureeInterruptionMinutes: 360, mesures: '' })
  })
})
