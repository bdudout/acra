import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/analyses' }))
import AnalysesClient from '@/components/AnalysesClient'

// jsdom n'implémente pas Blob.text()
if (typeof Blob.prototype.text !== 'function') Blob.prototype.text = function (this: Blob) { return new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(this) }) }
const fetchMock = vi.fn()
// La liste paginée (GET /api/analyses?page=…) est chargée au montage ; les assertions portent sur les appels d'import.
const LISTE = { ok: true, json: async () => ({ analyses: [], pagination: { page: 1, taille: 50, total: 0, pages: 1 }, synthese: { total: 0, tags: [] } }) }
const appelsHorsListe = () => fetchMock.mock.calls.filter(c => !String(c[0]).startsWith('/api/analyses?'))
beforeEach(() => { fetchMock.mockReset(); fetchMock.mockResolvedValue(LISTE); vi.stubGlobal('fetch', fetchMock) })

const OLE2 = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0])
const file = (content: BlobPart, name: string) => new File([content], name)
const pick = (label: string | RegExp, f: File) => fireEvent.change(screen.getByLabelText(label, { selector: 'input' }), { target: { files: [f] } })

describe('AnalysesClient — messages d’import', () => {
  it('.xls : « non pris en charge, .xlsx pris en charge », sans appel serveur', async () => {
    render(<AnalysesClient />)
    pick('Excel historique', file(OLE2, 'analyse.xls'))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Le format .xls n’est pas pris en charge')
    expect(alert.textContent).toContain('.xlsx')
    expect(appelsHorsListe()).toHaveLength(0)
  })
  it('.xls renommé en .xlsx : même message', async () => {
    render(<AnalysesClient />)
    pick('Excel historique', file(OLE2, 'analyse.xlsx'))
    expect((await screen.findByRole('alert')).textContent).toContain('.xls')
  })
  it('JSON illisible : titre explicite, ligne / colonne / extrait et cause probable (plus de « fichier json invalide »)', async () => {
    fetchMock.mockImplementation(async (u: string) => String(u).startsWith('/api/analyses?') ? LISTE : { ok: false, json: async () => ({ error: 'json_invalid', details: { line: 3, column: 1, snippet: '"nom": "A", }', hint: 'trailing_comma' } }) })
    render(<AnalysesClient />)
    pick('Importer une analyse', file('{\n "nom": "A",\n}', 'export.json'))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('erreur de syntaxe')
    expect(screen.getByTestId('import-error-where').textContent).toBe('Ligne 3, colonne 1 — près de : « "nom": "A", } »')
    expect(alert.textContent).toContain('virgule')
    expect(alert.textContent).not.toMatch(/invalide\.$/)
  })
  it('classeur Excel choisi dans « Export ACRA » : orienté vers l’import Excel', async () => {
    render(<AnalysesClient />)
    pick('Importer une analyse', file(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]), 'x.xlsx'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Excel historique'))
    expect(appelsHorsListe()).toHaveLength(0)
  })
})
