import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HomologationsManager, { type HomologationRow } from '@/components/HomologationsManager'
import { piecesInitiales } from '@/lib/homologation'

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const complet = piecesInitiales().map(p => ({ ...p, fourni: true }))
const row = (o: Partial<HomologationRow> = {}): HomologationRow => ({
  id: 'h1', systeme: 'Portail usagers', perimetre: null, statut: 'COMMISSION', etat: 'NON_DECIDEE', analyseId: null, analyseNom: null,
  preparePar: 'prep', autoriteId: 'auto', dureeMois: 36, pieces: complet, reserves: [], dateDecision: null, dateFin: null, commentaireDecision: null, ...o,
})
const props = { analyses: [{ id: 'a1', nom: 'Analyse portail' }], membres: [{ id: 'auto', nom: 'Autorité' }] }
const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) })
  vi.stubGlobal('fetch', fetchMock)
})

describe('HomologationsManager', () => {
  it('liste les homologations avec leur statut et leur validité', () => {
    render(<HomologationsManager {...props} initial={[row({ statut: 'HOMOLOGUE', etat: 'A_RENOUVELER', dateFin: '2027-01-01T00:00:00Z' })]} userId="u" role="RSSI" />)
    expect(screen.getByText('Portail usagers')).toBeInTheDocument()
    expect(screen.getByText('Homologué')).toBeInTheDocument()
    expect(screen.getByText('À renouveler')).toBeInTheDocument()
  })

  it('un préparateur ouvre un dossier (POST)', async () => {
    render(<HomologationsManager {...props} initial={[]} userId="prep" role="RSSI" />)
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau dossier' }))
    fireEvent.change(screen.getByLabelText('Système à homologuer'), { target: { value: 'Téléservice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le dossier' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/homologations', expect.objectContaining({ method: 'POST' })))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ systeme: 'Téléservice', dureeMois: 36 })
  })

  it('lecture seule pour un rôle non préparateur : pas de création', () => {
    render(<HomologationsManager {...props} initial={[]} userId="x" role="LECTEUR" />)
    expect(screen.queryByRole('button', { name: 'Nouveau dossier' })).toBeNull()
    expect(screen.getByText(/Consultation seule/)).toBeInTheDocument()
  })

  it('le préparateur ne voit pas les boutons de décision (séparation)', () => {
    render(<HomologationsManager {...props} initial={[row()]} userId="prep" role="RSSI" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(screen.queryByRole('button', { name: 'Homologuer' })).toBeNull()
    expect(screen.getByText(/la décision revient à une autre personne/)).toBeInTheDocument()
  })

  it('l’autorité homologue (transition) ; le message d’erreur métier est affiché', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'dossier_incomplet' }) })
    render(<HomologationsManager {...props} initial={[row()]} userId="auto" role="ANALYSTE" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Homologuer' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/homologations/h1', expect.objectContaining({ method: 'PATCH' })))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: 'transition', to: 'HOMOLOGUE' })
    expect(await screen.findByText(/Dossier incomplet : toutes les pièces/)).toBeInTheDocument()
  })
})
