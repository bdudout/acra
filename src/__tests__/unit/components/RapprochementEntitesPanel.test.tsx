// Rapprochement des textes libres (lot E3) : correspondances identiques présélectionnées, proches proposées sans être
// retenues d'office, création d'une entité à partir d'une valeur, décisions envoyées par lot.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RapprochementEntitesPanel from '@/components/RapprochementEntitesPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })
const PROPS = { propositions: [
  { valeur: 'dsi', total: 5, occurrences: { risques: 3, mesures: 2 }, brutes: ['dsi'], niveau: 'EXACTE', suggestion: { id: 'dsi', nom: 'DSI', score: 1, motif: 'NOM' }, autres: [] },
  { valeur: 'Ressource humaine', total: 1, occurrences: { incidents: 1 }, brutes: ['Ressource humaine'], niveau: 'PROCHE', suggestion: { id: 'rh', nom: 'Ressources humaines', score: 0.9, motif: 'NOM' }, autres: [] },
  { valeur: 'Juridique', total: 2, occurrences: { plansAction: 2 }, brutes: ['Juridique'], niveau: 'AUCUNE', autres: [] },
] }
const entites = [{ id: 'dsi', nom: 'DSI' }, { id: 'rh', nom: 'Ressources humaines' }]
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('RapprochementEntitesPanel', () => {
  it('identique présélectionnée, proche suggérée mais non retenue ; création ; envoi par lot', async () => {
    const posts: unknown[] = []
    fetchMock.mockImplementation(async (_u: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'POST') { posts.push(JSON.parse(init.body!)); return json({ liens: 2, creees: 1, objets: 7 }) }
      return json(posts.length ? { propositions: [] } : PROPS)
    })
    const fini = vi.fn()
    render(<RapprochementEntitesPanel entites={entites} onTermine={fini} onFermer={() => {}} />)
    const dsi = await screen.findByLabelText('Entité du référentiel — dsi') as HTMLSelectElement
    expect(dsi.value).toBe('dsi')
    expect(screen.getByText(/3 risques · 2 mesures/)).toBeTruthy()
    const rh = screen.getByLabelText('Entité du référentiel — Ressource humaine') as HTMLSelectElement
    expect(rh.value).toBe('')
    expect(screen.getByText('proche')).toBeTruthy()
    fireEvent.change(rh, { target: { value: 'rh' } })
    fireEvent.change(screen.getByLabelText('Entité du référentiel — Juridique'), { target: { value: '__creer__' } })
    fireEvent.change(screen.getByLabelText('Type — Juridique'), { target: { value: 'SERVICE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer (3)' }))
    await waitFor(() => expect(fini).toHaveBeenCalled())
    expect(posts[0]).toEqual({ decisions: [{ valeur: 'dsi', entiteId: 'dsi' }, { valeur: 'Ressource humaine', entiteId: 'rh' }, { valeur: 'Juridique', creer: 'SERVICE' }] })
    expect(await screen.findByText('2 valeur(s) rapprochée(s), 1 entité(s) créée(s), 7 objet(s) liés.')).toBeTruthy()
    expect(screen.getByText('Toutes les valeurs saisies sont déjà rapprochées.')).toBeTruthy()
  })

  it('erreur expliquée', async () => {
    fetchMock.mockImplementation(async (_u: string, init?: { method?: string }) => init?.method === 'POST' ? json({ error: 'entite_invalide' }, 400) : json(PROPS))
    render(<RapprochementEntitesPanel entites={entites} onTermine={() => {}} onFermer={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Appliquer (1)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Entité introuvable ou close.')
  })
})
