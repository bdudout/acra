// Import vers le référentiel des entités (lot E2) : aperçu des écarts par statut, choix (doublons confirmés,
// renommages décochables, clôtures cochées) envoyés à l'application ; connecteur proposé s'il est configuré.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImportEntitesPanel from '@/components/ImportEntitesPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })
const APERCU = {
  colonnes: { nom: 'Nom', code: 'Code' },
  compte: { NOUVELLE: 1, RENOMMEE: 1, INCHANGEE: 0, DOUBLON_PROBABLE: 1, REJETEE: 1 },
  lignes: [
    { line: 2, statut: 'NOUVELLE', nom: 'Achats', type: 'DIRECTION', alias: [] },
    { line: 3, statut: 'RENOMMEE', nom: 'DSI groupe', ancienNom: 'DSI', entiteId: 'dsi', type: 'SERVICE', alias: [] },
    { line: 4, statut: 'DOUBLON_PROBABLE', nom: 'Ressource humaine', entiteId: 'rh', type: 'DIRECTION', alias: [] },
    { line: 5, statut: 'REJETEE', raison: 'parent_inconnu', nom: 'Agence', type: 'SITE', alias: [] },
  ],
  disparues: [{ id: 'lyon', nom: 'Site Lyon' }],
}
const existantes = [{ id: 'rh', nom: 'Ressources humaines' }, { id: 'dsi', nom: 'DSI' }]
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

function choisirFichier() {
  const file = new File(['Nom\nAchats\n'], 'entites.csv', { type: 'text/csv' })
  fireEvent.change(screen.getByLabelText('Fichier'), { target: { files: [file] } })
}

describe('ImportEntitesPanel', () => {
  it('aperçu groupé par statut, raisons des rejets, puis application des choix', async () => {
    const bodies: Record<string, unknown>[] = []
    fetchMock.mockImplementation(async (_u: string, init: { body: string }) => {
      const b = JSON.parse(init.body); bodies.push(b)
      return b.dryRun ? json(APERCU) : json({ crees: 2, renommees: 0, closes: 1 }, 201)
    })
    const fini = vi.fn()
    render(<ImportEntitesPanel connecteur={false} existantes={existantes} onTermine={fini} onFermer={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Depuis l’annuaire' })).toBeNull()
    choisirFichier()
    fireEvent.click(screen.getByLabelText(/liste complète/))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Aperçu' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    expect(await screen.findByText('Nouvelles (1)')).toBeTruthy()
    expect(screen.getByText(/parent introuvable/)).toBeTruthy()
    expect(screen.getByText(/proche de « Ressources humaines »/)).toBeTruthy()
    expect(bodies[0]).toMatchObject({ origine: 'FICHIER', filename: 'entites.csv', dryRun: true, listeComplete: true })
    fireEvent.click(screen.getByLabelText('créer quand même — Ressource humaine'))
    fireEvent.click(screen.getByLabelText('renommer — DSI groupe')) // décoche le renommage
    fireEvent.click(screen.getByLabelText('clore — Site Lyon'))
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }))
    await waitFor(() => expect(fini).toHaveBeenCalled())
    expect(bodies[1]).toMatchObject({ creerQuandMeme: [4], renommer: [], clore: ['lyon'] })
    expect(bodies[1].dryRun).toBeUndefined()
    expect(screen.getByText('2 créée(s), 0 renommée(s), 1 close(s).')).toBeTruthy()
  })

  it('connecteur configuré : aperçu depuis l’annuaire', async () => {
    fetchMock.mockResolvedValue(json({ ...APERCU, colonnes: undefined }))
    render(<ImportEntitesPanel connecteur existantes={existantes} onTermine={() => {}} onFermer={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Depuis l’annuaire' }))
    await screen.findByText('Nouvelles (1)')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ origine: 'CONNECTEUR', dryRun: true })
  })

  it('erreur expliquée (colonne « Nom » absente)', async () => {
    fetchMock.mockResolvedValue(json({ error: 'name_column_missing' }, 400))
    render(<ImportEntitesPanel connecteur={false} existantes={existantes} onTermine={() => {}} onFermer={() => {}} />)
    choisirFichier()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Aperçu' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Colonne « Nom » introuvable.')
  })
})
