/**
 * RopaManager.test.tsx — registre des traitements (RGPD art. 30).
 *  - Liste + synthèse (fetch mocké), badges complétude/AIPD
 *  - Création : POST puis rechargement
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RopaManager from '@/components/RopaManager'

const listResponse = {
  traitements: [
    {
      id: 't1', nom: 'Paie', finalite: 'Gestion de la paie', baseLegale: 'obligation_legale',
      categoriesPersonnes: ['Salariés'], categoriesDonnees: ['Identité', 'RIB'], destinataires: ['DRH'],
      transfertHorsUE: false, dureeConservation: '5 ans', mesuresSecurite: ['Chiffrement'],
      evaluation: { complet: true, champsManquants: [], pia: { requis: false, motifs: [] } },
    },
  ],
  synthese: { total: 1, complets: 1, piaRequis: 0 },
  canManage: true,
}

describe('RopaManager', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('liste les traitements et la synthèse', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => listResponse }))
    render(<RopaManager />)
    expect(await screen.findByText('Paie')).toBeInTheDocument()
    expect(screen.getByText('Obligation légale')).toBeInTheDocument() // base légale mappée
  })

  it('crée un traitement (POST + reload)', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ traitements: [], synthese: { total: 0, complets: 0, piaRequis: 0 } }) }) // reload initial
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 't2' }) }) // POST
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => listResponse }) // reload
    vi.stubGlobal('fetch', fetchMock)

    render(<RopaManager />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un traitement/i }))
    fireEvent.change(screen.getByLabelText('Nom du traitement'), { target: { value: 'Nouveau' } })
    fireEvent.click(screen.getByRole('button', { name: /^Créer$/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const post = fetchMock.mock.calls[1]
    expect(post[0]).toBe('/api/ropa')
    expect(JSON.parse(post[1].body).nom).toBe('Nouveau')
  })
})
