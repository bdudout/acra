import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DerogationsRegistre, { type RegistreRow } from '@/components/DerogationsRegistre'

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
// Registre paginé côté serveur : filtre « En revue » dans l'URL (lot V1).
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams('filtre=EN_REVUE'), usePathname: () => '/derogations' }))
vi.mock('@/components/AutocompleteInput', () => ({ default: () => <input /> }))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    t: {
      loading: '…', search: 'Rechercher…',
      pagination: { navigation: 'Pagination', resultats: '{debut} à {fin} sur {total}', parPage: 'Par page', precedente: 'Précédente', suivante: 'Suivante', page: 'Page {page} sur {pages}' },
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
    const PAGE = { rows: [row], pagination: { page: 1, taille: 50, total: 1, pages: 1 }, synthese: { total: 1, compteurs: { EN_COURS_EXP: 0, EN_COURS: 0, EXPIREES: 0, EN_REVUE: 1, CLOTUREES: 0 } } }
    const DETAIL = {
        id: 'de1', statut: 'DEMANDEE', portee: 'CONTROLE', referentiel: 'ISO27001', ref: 'A.5.1',
        intitule: 'Dérogation chiffrement', motif: 'Contrainte technique', mesuresCompensatoires: 'Chiffrement applicatif',
        dateDebut: null, dateFin: null, demandeurId: 'analyste-x', avisRssiPar: null, avisRssiLe: null,
        avisRssiFavorable: null, avisRssiCommentaire: null, valideePar: null, valideeLe: null,
        rejetMotif: null, clotureCommentaire: null, createdAt: '2026-09-14T00:00:00.000Z',
    }
    const fetchMock = vi.fn(async (u: string, init?: RequestInit) => ({
      ok: true,
      json: async () => (u.startsWith('/api/derogations?') ? PAGE : init?.method === 'PATCH' ? { ok: true } : DETAIL),
    }))
    global.fetch = fetchMock as unknown as typeof fetch

    render(<DerogationsRegistre locale="fr" userId="rssi-1" userRole="RSSI" secondeLigneActive />)

    // Page « En revue » demandée au serveur ; compteur issu de la synthèse.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/derogations?filtre=EN_REVUE&page=1'))
    expect(await screen.findByText('En revue (1)')).toBeTruthy()
    // Ouvrir le détail de la ligne.
    fireEvent.click(await screen.findByText('Dérogation chiffrement'))

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
