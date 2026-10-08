// Réorganisations (lot E4) : formulaire par opération (renommer, fusionner, scinder, clore), corps envoyé à l'API,
// erreurs expliquées ; historique lisible (date, opération, sources → résultats, objets reportés).
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReorganisationEntitePanel from '@/components/ReorganisationEntitePanel'
import HistoriqueEntites from '@/components/HistoriqueEntites'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })
const entites = [{ id: 'a', nom: 'Achats' }, { id: 'b', nom: 'Appro' }, { id: 'c', nom: 'Compta' }]
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
const corps = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body)

function ouvrir() {
  const fini = vi.fn()
  render(<ReorganisationEntitePanel entite={entites[0]} entites={entites} onTermine={fini} onAnnuler={() => {}} />)
  fireEvent.change(screen.getByLabelText('Date d’effet'), { target: { value: '2026-10-01' } })
  return fini
}

describe('ReorganisationEntitePanel', () => {
  it('renommer', async () => {
    fetchMock.mockResolvedValue(json({ objets: 0 }, 201))
    const fini = ouvrir()
    expect(screen.getByText(/L’ancien nom est conservé en alias/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Nouveau nom'), { target: { value: 'Achats groupe' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider la réorganisation' }))
    await waitFor(() => expect(fini).toHaveBeenCalled())
    expect(corps()).toEqual({ type: 'RENOMMAGE', dateEffet: '2026-10-01', sources: ['a'], nouveauNom: 'Achats groupe' })
  })

  it('fusionner dans une entité existante ou nouvelle', async () => {
    fetchMock.mockResolvedValue(json({ objets: 3 }, 201))
    const fini = ouvrir()
    fireEvent.change(screen.getByLabelText('Opération'), { target: { value: 'FUSION' } })
    fireEvent.click(screen.getByLabelText('Appro'))
    fireEvent.change(screen.getByLabelText('Entité résultante'), { target: { value: 'b' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider la réorganisation' }))
    await waitFor(() => expect(fini).toHaveBeenCalled())
    expect(corps()).toEqual({ type: 'FUSION', dateEffet: '2026-10-01', sources: ['a', 'b'], cible: { id: 'b' } })
    fireEvent.change(screen.getByLabelText('Entité résultante'), { target: { value: '__nouvelle__' } })
    fireEvent.change(screen.getByLabelText('Nom de la nouvelle entité'), { target: { value: 'Achats et appro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider la réorganisation' }))
    await waitFor(() => expect(corps().cible).toEqual({ nom: 'Achats et appro', type: 'DIRECTION' }))
  })

  it('scinder (avec repreneur) et clore (avec successeur)', async () => {
    fetchMock.mockResolvedValue(json({ objets: 0 }, 201))
    ouvrir()
    fireEvent.change(screen.getByLabelText('Opération'), { target: { value: 'SCISSION' } })
    fireEvent.change(screen.getByLabelText('Nouvelles entités 1'), { target: { value: 'Achats IT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une entité' }))
    fireEvent.change(screen.getByLabelText('Nouvelles entités 2'), { target: { value: 'Achats hors IT' } })
    fireEvent.change(screen.getByLabelText('Reprend les objets rattachés'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider la réorganisation' }))
    await waitFor(() => expect(corps()).toEqual({ type: 'SCISSION', dateEffet: '2026-10-01', sources: ['a'], nouvelles: [{ nom: 'Achats IT', type: 'DIRECTION' }, { nom: 'Achats hors IT', type: 'DIRECTION' }], repreneur: 1 }))
    fireEvent.change(screen.getByLabelText('Opération'), { target: { value: 'CLOTURE' } })
    fireEvent.change(screen.getByLabelText('Successeur'), { target: { value: 'c' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider la réorganisation' }))
    await waitFor(() => expect(corps()).toEqual({ type: 'CLOTURE', dateEffet: '2026-10-01', sources: ['a'], successeur: 'c' }))
  })

  it('erreur expliquée', async () => {
    fetchMock.mockResolvedValue(json({ error: 'sources_insuffisantes' }, 400))
    ouvrir()
    fireEvent.change(screen.getByLabelText('Opération'), { target: { value: 'FUSION' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider la réorganisation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Choisissez au moins une autre entité à fusionner.')
  })
})

describe('HistoriqueEntites', () => {
  it('liste les réorganisations, de la plus récente à la plus ancienne', async () => {
    fetchMock.mockResolvedValue(json({ evenements: [
      { id: 'e2', type: 'FUSION', dateEffet: '2026-10-01T00:00:00.000Z', sources: [{ id: 'a', nom: 'Achats' }, { id: 'b', nom: 'Appro' }], cibles: [{ id: 'n', nom: 'Achats et appro' }], nbObjets: 3 },
      { id: 'e1', type: 'RENOMMAGE', dateEffet: '2026-01-15T00:00:00.000Z', sources: [{ id: 'c', nom: 'Compta' }], cibles: [{ id: 'c', nom: 'Comptabilité' }], nbObjets: 0 },
    ] }))
    render(<HistoriqueEntites />)
    expect(await screen.findByText(/Fusionner : Achats, Appro → Achats et appro/)).toBeTruthy()
    expect(screen.getByText('3 objet(s) reporté(s)')).toBeTruthy()
    expect(screen.getByText(/Renommer : Compta → Comptabilité/)).toBeTruthy()
  })
  it('vide', async () => {
    fetchMock.mockResolvedValue(json({ evenements: [] }))
    render(<HistoriqueEntites />)
    expect(await screen.findByText('Aucune réorganisation enregistrée.')).toBeTruthy()
  })
})
