// Registre du sous-traitant (RGPD art. 30 §2) : liste avec manques en clair, ajout d'un responsable client.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RopaSousTraitanceManager from '@/components/RopaSousTraitanceManager'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const ligne = { id: 's1', clientNom: 'Hôpital X', clientContact: 'dpo@h.fr', clientDpo: '', categoriesTraitements: ['Hébergement'], transfertHorsUE: true, paysTransfert: 'Inde', garantiesTransfert: '', mesuresSecurite: [], manquants: ['mesuresSecurite', 'garantiesTransfert'] }
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('RopaSousTraitanceManager', () => {
  it('liste : responsable client, catégories, manques en clair', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ lignes: [ligne] }) })
    render(<RopaSousTraitanceManager />)
    expect(await screen.findByText('Hôpital X')).toBeInTheDocument()
    expect(screen.getByText('Hébergement')).toBeInTheDocument()
    expect(screen.getByText('Manque : Mesures de sécurité, Garanties appropriées')).toBeInTheDocument()
  })
  it('ajout d’un responsable du traitement client (POST puis rechargement)', async () => {
    const posts: unknown[] = []
    fetchMock.mockImplementation(async (_u: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'POST') { posts.push(JSON.parse(init.body!)); return { ok: true, json: async () => ({ id: 'n' }) } }
      return { ok: true, json: async () => ({ lignes: [] }) }
    })
    render(<RopaSousTraitanceManager />)
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter un responsable du traitement client/ }))
    fireEvent.change(screen.getByLabelText('Responsable du traitement (client)'), { target: { value: 'Clinique Y' } })
    fireEvent.change(screen.getByLabelText('Catégories de traitements effectués pour son compte'), { target: { value: 'Hébergement, Sauvegarde' } })
    fireEvent.change(screen.getByLabelText('Mesures de sécurité'), { target: { value: 'Chiffrement' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({ clientNom: 'Clinique Y', categoriesTraitements: ['Hébergement', 'Sauvegarde'], mesuresSecurite: ['Chiffrement'], transfertHorsUE: false })
  })
})
