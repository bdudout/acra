// Page « À traiter » et lien du menu : éléments regroupés par urgence avec lien vers l'objet ; organisation affichée quand
// il y en a plusieurs ; message quand rien n'attend ; compteur du menu (en retard mis en avant).
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ATraiterClient from '@/components/ATraiterClient'
import ATraiterLien from '@/components/ATraiterLien'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body } as Response)
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
const item = (o: Record<string, unknown>) => ({ categorie: 'X', intitule: 'Objet', type: 'EN_RETARD', echeance: '2026-10-01', organisationId: 'o1', organisation: 'Banque', lien: '/x', libelleCategorie: 'Catégorie', etat: 'état', ...o })

describe('ATraiterClient', () => {
  it('regroupe par urgence (en retard d’abord), lien vers l’objet, organisation affichée s’il y en a plusieurs', async () => {
    fetchMock.mockImplementation(() => ok({ total: 3, enRetard: 1, items: [
      item({ intitule: 'Test de bascule', libelleCategorie: 'Test de résilience planifié', etat: 'en retard (échéance le 2026-10-01)', lien: '/reglementaire/tests-resilience' }),
      item({ intitule: 'Programme 2027', type: 'EN_ATTENTE', libelleCategorie: 'Plan annuel d’audit ou de contrôle à valider', etat: 'en attente depuis le 2026-10-05', lien: '/plans/p1', organisationId: 'o2', organisation: 'Filiale' }),
      item({ intitule: 'Contrat C-42', type: 'ECHEANCE_PROCHE', lien: '/registre-tic' }),
    ] }))
    render(<ATraiterClient />)
    const retard = await screen.findByRole('region', { name: 'En retard (1)' })
    expect(within(retard).getByRole('link', { name: 'Test de bascule' })).toHaveAttribute('href', '/reglementaire/tests-resilience')
    expect(within(retard).getByText('Test de résilience planifié')).toBeInTheDocument()
    expect(within(retard).getByText(/Banque/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Décisions en attente (1)' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Échéance proche (1)' })).toBeInTheDocument()
  })
  it('rien à traiter : message', async () => {
    fetchMock.mockImplementation(() => ok({ total: 0, enRetard: 0, items: [] }))
    render(<ATraiterClient />)
    expect(await screen.findByText('Rien ne vous attend pour le moment.')).toBeInTheDocument()
  })
})

describe('ATraiterLien (menu)', () => {
  it('compteur, en retard signalé ; lien vers la page', async () => {
    fetchMock.mockImplementation(() => ok({ total: 4, enRetard: 2 }))
    render(<ATraiterLien />)
    const lien = await screen.findByRole('link', { name: 'À traiter : 4 élément(s), dont 2 en retard' })
    expect(lien).toHaveAttribute('href', '/a-traiter')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/a-traiter?compte=1')
  })
})
