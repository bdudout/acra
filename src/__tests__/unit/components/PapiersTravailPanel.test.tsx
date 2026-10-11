import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PapiersTravailPanel from '@/components/PapiersTravailPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

const papier = (o = {}) => ({ id: 'p1', type: 'TEST', titre: 'Revue des accès', travaux: 'Échantillon de 25', statut: 'BROUILLON', preparePar: 'a1', prepareLe: '2026-09-29T10:00:00Z', ...o })
const liste = (papiers: unknown[], moi: string) => ({ ok: true, json: async () => ({ papiers, utilisateurs: { a1: 'Alice', a2: 'Bob' }, moi }) })

describe('PapiersTravailPanel', () => {
  it('le préparateur voit modifier / soumettre sur son brouillon, pas de revue', async () => {
    fetchMock.mockResolvedValue(liste([papier()], 'a1'))
    render(<PapiersTravailPanel missionId="m1" />)
    expect(await screen.findByText('Revue des accès')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Soumettre à revue' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Revoir (valider)' })).toBeNull()
  })
  it('un autre auditeur revoit un papier soumis ; le préparateur ne le peut pas', async () => {
    fetchMock.mockResolvedValue(liste([papier({ statut: 'SOUMIS' })], 'a2'))
    const { unmount } = render(<PapiersTravailPanel missionId="m1" />)
    await screen.findByText('Revue des accès')
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ papiers: [] }) }).mockResolvedValue(liste([papier({ statut: 'REVU' })], 'a2'))
    fireEvent.change(screen.getByLabelText(/Commentaire de revue/), { target: { value: 'RAS' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revoir (valider)' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST' && JSON.parse(c[1].body).action === 'REVOIR' && JSON.parse(c[1].body).commentaire === 'RAS')).toBe(true))
    unmount()
    fetchMock.mockReset(); fetchMock.mockResolvedValue(liste([papier({ statut: 'SOUMIS' })], 'a1'))
    render(<PapiersTravailPanel missionId="m1" />)
    await screen.findByText('Revue des accès')
    expect(screen.queryByRole('button', { name: 'Revoir (valider)' })).toBeNull()
  })
  it('lecture seule : aucune action ; erreur serveur traduite', async () => {
    fetchMock.mockResolvedValue(liste([papier()], 'a1'))
    render(<PapiersTravailPanel missionId="m1" readOnly />)
    await screen.findByText('Revue des accès')
    expect(screen.queryByRole('button', { name: 'Nouveau papier' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Soumettre à revue' })).toBeNull()
  })
  it('trame libre : constat étayé et pièces de la bibliothèque — saisis, enregistrés, affichés avec lien de téléchargement', async () => {
    const options = { constats: [{ id: 'c1', intitule: 'Revues d’accès non tracées' }], documents: [{ id: 'd1', titre: 'Extraction des comptes', type: 'PREUVE' }] }
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) => (init?.method === 'POST'
      ? { ok: true, json: async () => ({ papiers: [] }) }
      : { ok: true, json: async () => ({ papiers: [papier({ constatId: 'c1', documentIds: ['d1'] })], utilisateurs: { a1: 'Alice' }, moi: 'a1', options }) }))
    render(<PapiersTravailPanel missionId="m1" />)
    expect(await screen.findByText(/Constat étayé : Revues d’accès non tracées/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Extraction des comptes' })).toHaveAttribute('href', '/api/documents/d1/download')
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau papier' }))
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Test des sauvegardes' } })
    fireEvent.change(screen.getByLabelText('Constat étayé'), { target: { value: 'c1' } })
    fireEvent.click(screen.getByLabelText('Extraction des comptes'))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(true))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'POST')![1].body)
    expect(body.data).toMatchObject({ titre: 'Test des sauvegardes', constatId: 'c1', documentIds: ['d1'] })
  })
})
