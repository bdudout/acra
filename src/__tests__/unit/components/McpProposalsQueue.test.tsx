import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import McpProposalsQueue from '@/components/McpProposalsQueue'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('McpProposalsQueue — démo projet 360', () => {
  it('proposition de projet : libellé, organisation, secteur et mise en service ; risque : domaine, mesures et plans', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ proposals: [
      { id: 'p1', type: 'projet360', targetType: 'ORGANISATION', targetId: 'org', ancreNom: 'Mutuelle Horizon Santé', createdAt: '2026-10-06T10:00:00Z', payload: { nom: 'Espace adhérent 2027', secteur: 'Santé / Médico-social', miseEnService: '2027-03-01', description: 'Portail et application' } },
      { id: 'p2', type: 'risk', targetType: 'ANALYSE', targetId: 'a1', ancreNom: 'Espace adhérent 2027', createdAt: '2026-10-06T10:01:00Z', payload: { nom: 'Fuite de données de santé', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE', domaine: 'CYBER', mesures: [{ nom: 'Chiffrement' }], plans: [{ titre: 'Choisir un hébergeur HDS' }, { titre: 'AIPD' }] } },
    ] }) })
    render(<McpProposalsQueue />)
    expect(await screen.findByText('Espace adhérent 2027', { selector: 'p' })).toBeTruthy()
    expect(screen.getByText(/Projet 360 proposé · Mutuelle Horizon Santé/)).toBeTruthy()
    expect(screen.getByText(/Santé \/ Médico-social · Mise en service 01\/03\/2027/)).toBeTruthy()
    expect(screen.getByText(/Domaine Cyber · 1 mesure\(s\) · 2 plan\(s\) d’action/)).toBeTruthy()
    // Stratégie affichée par son libellé, pas par son code.
    expect(screen.getByText(/Stratégie Réduire/)).toBeTruthy()
    expect(screen.queryByText(/REDUIRE/)).toBeNull()
  })

  it('nouvelle analyse et PSSI : titre, origine, méthode, volumes ; code, version, exigences et suivi', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ proposals: [
      { id: 'n1', type: 'analysis_create', targetType: 'ORGANISATION', targetId: 'org', ancreNom: 'Mutuelle Horizon Santé', createdAt: '2026-10-07T10:00:00Z', payload: { origine: 'ANALYSE_HISTORIQUE', analysis: { title: 'Portail patients 2024', methode: 'ISO_27005' }, risks: [{}, {}], measures: [{}], actions: [] } },
      { id: 'n2', type: 'pssi', targetType: 'ORGANISATION', targetId: 'org', ancreNom: 'Mutuelle Horizon Santé', createdAt: '2026-10-07T10:01:00Z', payload: { referentiel: { nom: 'PSSI groupe', code: 'PSSI-3-2', version: '3.2', exigences: [{}, {}, {}] }, suivreConformite: true } },
    ] }) })
    render(<McpProposalsQueue />)
    expect(await screen.findByText('Portail patients 2024', { selector: 'p' })).toBeTruthy()
    expect(screen.getByText(/Nouvelle analyse proposée · Mutuelle Horizon Santé/)).toBeTruthy()
    expect(screen.getByText(/Reprise d’une analyse existante · ISO\/IEC 27005:2022 · 2 risque\(s\) · 1 mesure\(s\) · 0 plan\(s\) d’action/)).toBeTruthy()
    expect(screen.getByText('PSSI groupe', { selector: 'p' })).toBeTruthy()
    expect(screen.getByText(/PSSI proposée/)).toBeTruthy()
    expect(screen.getByText(/Code PSSI-3-2 · version 3.2 · 3 exigence\(s\) · suivi de conformité/)).toBeTruthy()
  })

  it('acceptation refusée par le serveur (droits, code déjà pris) : le motif s’affiche sur la carte, qui reste dans la file', async () => {
    fetchMock.mockImplementation(async (_u: string, init?: { method?: string }) => init?.method === 'PATCH'
      ? { ok: false, status: 403, json: async () => ({ error: 'Validation non autorisée' }) }
      : { ok: true, json: async () => ({ proposals: [{ id: 'n2', type: 'pssi', targetType: 'ORGANISATION', targetId: 'org', ancreNom: 'Org', createdAt: '2026-10-07T10:01:00Z', payload: { referentiel: { nom: 'PSSI groupe', code: 'PSSI-3-2', exigences: [{}] } } }] }) })
    render(<McpProposalsQueue />)
    fireEvent.click(await screen.findByRole('button', { name: /Accepter/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Acceptation impossible : Validation non autorisée/)
    expect(screen.getByText('PSSI groupe', { selector: 'p' })).toBeTruthy()
  })
})
