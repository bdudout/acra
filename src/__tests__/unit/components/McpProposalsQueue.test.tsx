import { render, screen } from '@testing-library/react'
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
  })
})
