import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DerogationsRegistre, { type RegistreRow } from '@/components/DerogationsRegistre'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/components/AutocompleteInput', () => ({ default: () => <input /> }))
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const row: RegistreRow = { id: 'd1', analyseId: null, analyseNom: null, portee: 'CONTROLE', referentiel: 'ISO27001', ref: '5.1', intitule: 'Chiffrement', statut: 'DEMANDEE', dateFin: null }
const detail = (statut: string, extra = {}) => ({
  id: 'd1', statut, portee: 'CONTROLE', referentiel: 'ISO27001', ref: '5.1', intitule: 'Chiffrement', motif: 'Contrainte', mesuresCompensatoires: 'MFA',
  dateDebut: null, dateFin: null, demandeurId: 'dem', avisRssiPar: null, avisRssiLe: null, avisRssiFavorable: null, avisRssiCommentaire: null,
  valideePar: null, valideeLe: null, rejetMotif: null, clotureCommentaire: null, createdAt: '2026-09-14T00:00:00.000Z', ...extra,
})

beforeEach(() => { refresh.mockReset(); vi.stubGlobal('confirm', () => true) })

describe('DerogationsRegistre — actions en place', () => {
  it('le demandeur voit « Modifier / Retirer » ; après retrait la ligne reste ouverte, statut et confirmation visibles, sans rechargement', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => detail('DEMANDEE') })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...detail('RETIREE'), retireeLe: '2026-09-29T10:00:00.000Z' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => detail('RETIREE', { retireeLe: '2026-09-29T10:00:00.000Z' }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<DerogationsRegistre rows={[row]} locale="fr" userId="dem" userRole="ANALYSTE" secondeLigneActive />)
    fireEvent.click(screen.getByText(/En revue/))
    fireEvent.click(screen.getByText('Chiffrement'))
    expect(await screen.findByText('Votre demande :')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Modifier la demande/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Retirer la demande/ }))
    expect(await screen.findByText('Modification enregistrée.')).toBeTruthy()
    // Toujours ouverte (détail visible) et badge à jour, bien que « Retirée » sorte du filtre « En revue ».
    expect(screen.getByText('Contrainte')).toBeTruthy()
    const ligne = screen.getByText('Chiffrement').closest('tr')!
    expect(within(ligne).getByText('Retirée')).toBeTruthy()
    expect(screen.getByText(/Demande retirée le/)).toBeTruthy()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(refresh).not.toHaveBeenCalled()
  })
})
