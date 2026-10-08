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

describe('RopaManager — parcours DPO (lisibilité, export)', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  const t = (o: Record<string, unknown>) => ({
    id: 'x', nom: 'X', finalite: 'F', baseLegale: 'contrat', categoriesPersonnes: ['A'], categoriesDonnees: ['B'], destinataires: ['C'],
    transfertHorsUE: false, dureeConservation: '1 an', mesuresSecurite: ['M'], evaluation: { complet: true, champsManquants: [], pia: { requis: false, motifs: [] } }, ...o,
  })
  it('champs manquants et motifs de l’AIPD affichés en clair (libellés, pas de codes techniques)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      traitements: [
        t({ id: 'a', nom: 'Hébergement US', evaluation: { complet: false, champsManquants: ['garantiesTransfert', 'dureeConservation'], pia: { requis: false, motifs: [] } } }),
        t({ id: 'b', nom: 'Médecine du travail', evaluation: { complet: true, champsManquants: [], pia: { requis: true, motifs: ['donnees_sensibles_art9'] } } }),
      ],
      synthese: { total: 2, complets: 1, piaRequis: 1 }, canManage: true,
    }) }))
    render(<RopaManager />)
    expect(await screen.findByText(/Garanties \(art\. 44-46\), Durée de conservation/)).toBeInTheDocument()
    expect(screen.getByText(/Catégories particulières de données à caractère personnel \(art\. 9\)/)).toBeInTheDocument()
    expect(screen.queryByText(/garantiesTransfert|donnees_sensibles_art9/)).toBeNull()
  })
  it('export du registre (art. 30 §4 : mise à disposition de l’autorité de contrôle)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => listResponse }))
    render(<RopaManager />)
    expect(await screen.findByRole('link', { name: /Exporter le registre/ })).toHaveAttribute('href', '/api/ropa/export')
  })
})
