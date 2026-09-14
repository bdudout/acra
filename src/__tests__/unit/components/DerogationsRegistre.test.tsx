import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DerogationsRegistre, { type RegistreRow } from '@/components/DerogationsRegistre'

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/AutocompleteInput', () => ({ default: () => <input /> }))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    t: {
      loading: '…',
      derogations: {
        title: 'Dérogations', subtitle: 's', newBtn: 'Nouvelle', cancel: 'Annuler', submit: 'Créer',
        filterCurrentExpired: 'En cours+exp', filterCurrent: 'En cours', filterExpired: 'Expirées',
        filterReview: 'En revue', filterClosed: 'Clôturées',
        intitule: 'Intitulé', colAnalyse: 'Analyse', portee: 'Portée', colEtat: 'État', colEcheance: 'Échéance',
        empty: 'Aucune', orgLevel: 'Organisation', expiresIn: 'dans {n}', expiredSince: 'depuis {n}',
        portees: { CONTROLE: 'Contrôle' }, statuts: { DEMANDEE: 'Demandée' }, errors: {},
        detail: {
          loadError: 'err', motif: 'Motif', mesures: 'Mesures', demandeLe: 'Demandée le', debut: 'Début', fin: 'Fin',
          avisFavorable: 'Avis favorable', avisDefavorable: 'Avis défavorable', motifRejet: 'Rejet', aucuneAction: 'Aucune action',
          commentairePlaceholder: 'Commentaire', avisFavorableBtn: 'Avis favorable', avisDefavorableBtn: 'Avis défavorable',
          validerBtn: 'Valider', rejeterBtn: 'Rejeter', cloturerBtn: 'Clôturer', revoquerBtn: 'Révoquer',
        },
      },
    },
  }),
}))

const row: RegistreRow = {
  id: 'de1', analyseId: null, analyseNom: null, portee: 'CONTROLE', referentiel: 'ISO27001', ref: 'A.5.1',
  intitule: 'Dérogation chiffrement', statut: 'DEMANDEE', dateFin: null,
}

describe('DerogationsRegistre — vue détail + actions', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('un RSSI ouvre le détail et peut donner un avis favorable (PATCH AVIS_RSSI)', async () => {
    const fetchMock = vi.fn()
      // GET détail
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        id: 'de1', statut: 'DEMANDEE', portee: 'CONTROLE', referentiel: 'ISO27001', ref: 'A.5.1',
        intitule: 'Dérogation chiffrement', motif: 'Contrainte technique', mesuresCompensatoires: 'Chiffrement applicatif',
        dateDebut: null, dateFin: null, demandeurId: 'analyste-x', avisRssiPar: null, avisRssiLe: null,
        avisRssiFavorable: null, avisRssiCommentaire: null, valideePar: null, valideeLe: null,
        rejetMotif: null, clotureCommentaire: null, createdAt: '2026-09-14T00:00:00.000Z',
      }) })
      // PATCH action
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<DerogationsRegistre rows={[row]} locale="fr" userId="rssi-1" userRole="RSSI" secondeLigneActive />)

    // Le filtre par défaut masque les demandes → afficher « En revue ».
    fireEvent.click(screen.getByText(/En revue/))
    // Ouvrir le détail de la ligne.
    fireEvent.click(screen.getByText('Dérogation chiffrement'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/derogations/de1'))
    expect(await screen.findByText('Contrainte technique')).toBeTruthy()

    // Avis favorable → PATCH AVIS_RSSI { favorable: true }.
    fireEvent.click(screen.getByText('Avis favorable', { selector: 'button' }))
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(c => (c[1] as RequestInit | undefined)?.method === 'PATCH')
      expect(patch).toBeTruthy()
      expect(JSON.parse((patch![1] as RequestInit).body as string)).toMatchObject({ action: 'AVIS_RSSI', favorable: true })
    })
  })
})
