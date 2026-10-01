import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TicContractImportPanel from '@/components/TicContractImportPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
const preview = {
  sheet: 'contrats', columns: {}, counts: { ready: 2, alreadyImported: 1, rejected: 1, certainLinks: 1 },
  lines: [
    { line: 2, status: 'READY', warnings: [], reference: 'C-1', prestataire: 'Acme', tier: { tierId: 't1', strength: 'STRONG' } },
    { line: 3, status: 'READY', warnings: ['criticite_default'], reference: 'C-2', prestataire: 'Beta', tier: { tierId: 't2', strength: 'WEAK' } },
    { line: 4, status: 'ALREADY_IMPORTED', warnings: [], reference: 'C-4', prestataire: 'Déjà' },
    { line: 5, status: 'REJECTED', reason: 'invalid_type', warnings: [], reference: 'C-3', prestataire: 'Gamma' },
  ],
}
const file = () => new File(['Référence;Prestataire\nC-1;Acme\n'], 'contrats.csv', { type: 'text/csv' })
const choose = () => fireEvent.change(screen.getByLabelText('Fichier de contrats'), { target: { files: [file()] } })

beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => preview })
})

describe('TicContractImportPanel', () => {
  it('aperçu : statuts, raisons, avertissements de valeur par défaut, niveau de certitude du rapprochement', async () => {
    render(<TicContractImportPanel onImported={vi.fn()} />)
    choose()
    const table = await screen.findByRole('table')
    expect(table).toHaveTextContent('Prête'); expect(table).toHaveTextContent('Déjà présente'); expect(table).toHaveTextContent('type de service inconnu')
    expect(table).toHaveTextContent('criticité absente'); expect(table).toHaveTextContent('LEI identique'); expect(table).toHaveTextContent('à confirmer ensuite')
    expect(screen.getByTestId('counts')).toHaveTextContent('2 prête(s)')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ filename: 'contrats.csv', dryRun: true })
  })
  it('le lien aux identités est une case à cocher explicite, décochée par défaut, transmise à l’import', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => preview })
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ ...preview, created: 2, linked: 1 }) })
    const onImported = vi.fn()
    render(<TicContractImportPanel onImported={onImported} />)
    choose(); await screen.findByRole('table')
    const box = screen.getByRole('checkbox', { name: /Rattacher 1 contrat\(s\)/ })
    expect(box).not.toBeChecked()
    fireEvent.click(box)
    fireEvent.click(screen.getByRole('button', { name: /Importer 2 contrat\(s\)/ }))
    await waitFor(() => expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ dryRun: false, linkCertain: true }))
    expect(await screen.findByRole('status')).toHaveTextContent('2 contrat(s) créé(s), dont 1 rattaché(s)')
    expect(onImported).toHaveBeenCalledOnce()
  })
  it('colonnes introuvables : message explicite avec les en-têtes lus', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'tic_columns_missing', headers: ['Machin'] }) })
    render(<TicContractImportPanel onImported={vi.fn()} />)
    choose()
    expect(await screen.findByRole('alert')).toHaveTextContent('Machin')
  })
})
