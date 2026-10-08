// Référentiel des entités (consolidation, lot E1) : hiérarchie, entités closes masquées, lecture seule hors ADMIN,
// doublon probable à confirmer, champs verrouillés quand l'annuaire fait foi, suppression réservée aux entités libres.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReferentielEntites from '@/components/ReferentielEntites'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })
const zero = { risques: 0, incidents: 0, conformites: 0, plansAction: 0, traitementsConformite: 0, mesures: 0, enfants: 0 }
const E = (o: Record<string, unknown>) => ({ type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, organisationLieeId: null, source: 'MANUEL', valideDu: null, valideAu: null, _count: zero, ...o })
const LISTE = (o: Record<string, unknown> = {}) => ({
  peutModifier: true, sourceVerite: 'ACRA', organisations: [{ id: 'f1', nom: 'Filiale Sud' }],
  entites: [
    E({ id: 'g', nom: 'Groupe', type: 'FILIALE', _count: { ...zero, enfants: 1 } }),
    E({ id: 'dsi', nom: 'DSI', type: 'SERVICE', parentId: 'g', alias: ['Direction SI'], _count: { ...zero, risques: 3 } }),
    E({ id: 'old', nom: 'Ancien site', type: 'SITE', valideAu: '2025-01-01T00:00:00.000Z' }),
  ],
  ...o,
})
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('ReferentielEntites', () => {
  it('affiche la hiérarchie, masque les entités closes par défaut', async () => {
    fetchMock.mockResolvedValue(json(LISTE()))
    render(<ReferentielEntites />)
    expect(await screen.findByText('Groupe')).toBeTruthy()
    expect(screen.getByText('DSI')).toBeTruthy()
    expect(screen.getByText(/Direction SI/)).toBeTruthy()
    expect(screen.getByText(/3 objet\(s\) rattaché\(s\)/)).toBeTruthy()
    expect(screen.queryByText('Ancien site')).toBeNull()
    fireEvent.click(screen.getByLabelText('Afficher les entités closes'))
    expect(screen.getByText('Ancien site')).toBeTruthy()
    // Import (lot E2) : le panneau s'ouvre depuis le référentiel.
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))
    expect(screen.getByRole('region', { name: 'Importer des entités' })).toBeTruthy()
    // Rapprochement des textes libres (lot E3).
    fireEvent.click(screen.getByRole('button', { name: 'Rapprocher les textes libres' }))
    expect(screen.getByRole('region', { name: 'Rapprocher les textes libres' })).toBeTruthy()
    // Réorganisation (lot E4) : proposée sur les entités actives seulement ; historique affiché.
    expect(screen.queryByRole('button', { name: 'Réorganiser Ancien site' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Réorganiser DSI' }))
    expect(screen.getByRole('region', { name: 'Réorganiser « DSI »' })).toBeTruthy()
    expect(screen.getByText('Historique des réorganisations (5 ans)')).toBeTruthy()
  })

  it('hors ADMIN : consultation seule, aucun bouton de modification', async () => {
    fetchMock.mockResolvedValue(json(LISTE({ peutModifier: false })))
    render(<ReferentielEntites />)
    expect(await screen.findByText(/Consultation seule/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ajouter une entité' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Importer' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rapprocher les textes libres' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Modifier/ })).toBeNull()
  })

  it('doublon probable : affiche la correspondance puis crée sur confirmation', async () => {
    const posts: unknown[] = []
    fetchMock.mockImplementation(async (_u: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'POST') {
        const b = JSON.parse(init.body!); posts.push(b)
        return b.confirmer ? json({ id: 'n' }, 201) : json({ error: 'doublon', correspondances: [{ id: 'dsi', nom: 'DSI', score: 1, motif: 'NOM' }] }, 409)
      }
      return json(LISTE())
    })
    render(<ReferentielEntites />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter une entité' }))
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'dsi' } })
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'SERVICE' } })
    fireEvent.change(screen.getByLabelText('Alias (séparés par des virgules)'), { target: { value: 'Informatique, SI' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Une entité identique existe déjà :')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Créer quand même' }))
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[0]).toMatchObject({ nom: 'dsi', type: 'SERVICE', alias: ['Informatique', 'SI'] })
    expect(posts[1]).toMatchObject({ confirmer: true })
  })

  it('annuaire source de vérité : nom verrouillé pour une entité venue de l’annuaire', async () => {
    fetchMock.mockResolvedValue(json(LISTE({ sourceVerite: 'ANNUAIRE', entites: [E({ id: 'a', nom: 'Achats', source: 'ANNUAIRE' })] })))
    render(<ReferentielEntites />)
    expect(await screen.findByText(/L’annuaire fait foi/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Modifier Achats' }))
    expect(screen.getByLabelText('Nom')).toBeDisabled()
    expect(screen.getByLabelText('Alias (séparés par des virgules)')).not.toBeDisabled()
  })

  it('suppression proposée seulement pour une entité sans objet rattaché ; clôture pour les autres', async () => {
    fetchMock.mockResolvedValue(json(LISTE()))
    render(<ReferentielEntites />)
    await screen.findByText('DSI')
    expect(screen.queryByRole('button', { name: 'Supprimer DSI' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Clore DSI' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Supprimer Groupe' })).toBeNull() // a une entité rattachée
  })
})
