import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProcessusImportPanel from '@/components/ProcessusImportPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
const preview = {
  sheet: 'processus', columns: { ref: 'Réf.', parent: 'Parent', nom: 'Nom' },
  counts: { ready: 2, alreadyImported: 1, possibleDuplicate: 1, rejected: 1 },
  lines: [
    { line: 2, status: 'READY', nom: 'Achats', ref: 'P1' },
    { line: 3, status: 'READY', nom: 'Commande', ref: 'P1.1', parentLine: 2 },
    { line: 4, status: 'ALREADY_IMPORTED', nom: 'Finance', ref: 'F' },
    { line: 5, status: 'POSSIBLE_DUPLICATE', nom: 'RH', duplicateOfId: 'db1' },
    { line: 6, status: 'REJECTED', reason: 'unknown_parent', nom: 'Orphelin' },
  ],
}
const file = () => new File(['Réf.;Parent;Nom\nP1;;Achats\n'], 'processus.csv', { type: 'text/csv' })
const choose = () => fireEvent.change(screen.getByLabelText('Fichier CSV ou Excel des processus'), { target: { files: [file()] } })

beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => preview })
})

describe('ProcessusImportPanel — import guidé de processus', () => {
  it('affiche l’aperçu ligne à ligne : statut, raison en clair, compteurs', async () => {
    render(<ProcessusImportPanel onImported={vi.fn()} />)
    choose()
    expect(await screen.findByText('Achats')).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(table).toHaveTextContent('Prête'); expect(table).toHaveTextContent('Déjà importée'); expect(table).toHaveTextContent('Doublon possible')
    expect(table).toHaveTextContent('Parent introuvable')
    expect(screen.getByTestId('counts')).toHaveTextContent('2 prête(s)'); expect(screen.getByTestId('counts')).toHaveTextContent('1 rejetée(s)')
    expect(fetchMock).toHaveBeenCalledWith('/api/processus/import', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ filename: 'processus.csv', dryRun: true })
  })
  it('doublon possible : « Créer quand même » à cocher ; l’import envoie les lignes confirmées et le bouton se verrouille pendant l’appel', async () => {
    let release: (v: unknown) => void = () => {}
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => preview })
    fetchMock.mockImplementationOnce(() => new Promise(r => { release = r }))
    const onImported = vi.fn()
    render(<ProcessusImportPanel onImported={onImported} />)
    choose(); await screen.findByText('Achats')
    fireEvent.click(screen.getByRole('checkbox', { name: /Créer quand même.*RH/ }))
    const button = screen.getByRole('button', { name: /Importer 3 ligne\(s\)/ })
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByRole('button', { name: /Import en cours/ })).toBeDisabled())
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ dryRun: false, createAnyway: [5] })
    release({ ok: true, status: 201, json: async () => ({ ...preview, created: 3 }) })
    expect(await screen.findByRole('status')).toHaveTextContent('3 processus créé(s)')
    expect(onImported).toHaveBeenCalledOnce()
  })
  it('rien à importer : bouton désactivé', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...preview, counts: { ready: 0, alreadyImported: 1, possibleDuplicate: 0, rejected: 0 }, lines: [preview.lines[2]] }) })
    render(<ProcessusImportPanel onImported={vi.fn()} />)
    choose(); await screen.findByText('Finance')
    expect(screen.getByRole('button', { name: /Importer 0 ligne/ })).toBeDisabled()
  })
  it('colonne du nom introuvable : message clair avec les en-têtes lus', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'name_column_missing', headers: ['Machin', 'Truc'] }) })
    render(<ProcessusImportPanel onImported={vi.fn()} />)
    choose()
    expect(await screen.findByRole('alert')).toHaveTextContent('Machin, Truc')
  })
  it('fichier .xls refusé avant tout envoi', async () => {
    render(<ProcessusImportPanel onImported={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Fichier CSV ou Excel des processus'), { target: { files: [new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])], 'a.xls')] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('.xls')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
