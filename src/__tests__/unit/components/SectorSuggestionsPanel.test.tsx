import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectorSuggestionsPanel from '@/components/SectorSuggestionsPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
const items = [
  { key: 'core.process.digital', title: 'Exploiter les systèmes et les données', kind: 'PROCESS', sector: 'TRANSVERSAL', status: 'NEW', packVersion: '1.0' },
  { key: 'sante.risk.patient-data', title: 'Des données de santé de patients sont divulguées', kind: 'RISK', sector: 'SANTE', processKey: 'sante.process.records', status: 'NEW', packVersion: '1.0' },
  { key: 'core.risk.ransomware', title: 'Un rançongiciel interrompt les activités essentielles', kind: 'RISK', sector: 'TRANSVERSAL', processKey: 'core.process.digital', status: 'ALREADY_IMPORTED', packVersion: '1.0' },
]
const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body } as Response)

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation((_url: string, init?: RequestInit) => init?.method === 'POST'
    ? ok({ status: 201, created: [{ key: 'sante.risk.patient-data' }], alreadyImported: [], unlinked: [] }, 201)
    : ok({ sector: 'SANTE', configuredSectors: ['SANTE'], sectors: ['SANTE', 'FINANCE'], locale: 'fr', version: '1.0', items }))
  vi.stubGlobal('fetch', fetchMock)
})

describe('SectorSuggestionsPanel', () => {
  it('montre les suggestions sans sélection automatique, permet de choisir et affiche le bilan', async () => {
    const onImported = vi.fn()
    render(<SectorSuggestionsPanel canCreateProcesses onImported={onImported} />)
    fireEvent.click(screen.getByRole('button', { name: /Suggestions par secteur/ }))
    expect(await screen.findByText('Des données de santé de patients sont divulguées')).toBeInTheDocument()
    expect(screen.getByText('Exemples à qualifier, pas des risques évalués.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Des données de santé/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Un rançongiciel/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /Des données de santé/ }))
    fireEvent.click(screen.getByRole('button', { name: /Importer la sélection/ }))
    await waitFor(() => expect(fetchMock.mock.calls.some(call => call[1]?.method === 'POST')).toBe(true))
    const body = JSON.parse(String(fetchMock.mock.calls.find(call => call[1]?.method === 'POST')![1].body))
    expect(body.selectedKeys).toEqual(['sante.risk.patient-data'])
    expect(await screen.findByText(/1 élément créé/)).toBeInTheDocument()
    expect(onImported).toHaveBeenCalled()
  })

  it('exige une seconde validation si un processus associé n’est pas retenu', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => init?.method === 'POST'
      ? JSON.parse(String(init.body)).acceptUnlinked
        ? ok({ created: [{ key: 'sante.risk.patient-data' }], alreadyImported: [], unlinked: [{ key: 'sante.risk.patient-data', dependencyKey: 'sante.process.records' }] }, 201)
        : ok({ error: 'unlinked_dependencies', unlinked: [{ key: 'sante.risk.patient-data', dependencyKey: 'sante.process.records' }] }, 409)
      : ok({ sector: 'SANTE', configuredSectors: ['SANTE'], sectors: ['SANTE'], locale: 'fr', version: '1.0', items }))
    render(<SectorSuggestionsPanel canCreateProcesses={false} onImported={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Suggestions par secteur/ }))
    fireEvent.click(await screen.findByRole('checkbox', { name: /Des données de santé/ }))
    fireEvent.click(screen.getByRole('button', { name: /Importer la sélection/ }))
    expect(await screen.findByText(/sans rattachement au processus/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Importer sans ce lien/ }))
    await waitFor(() => expect(fetchMock.mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(2))
  })

  it('permet à l’ADMIN de mémoriser explicitement le secteur choisi sans importer', async () => {
    const onImported = vi.fn()
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => init?.method === 'PUT'
      ? ok({ sectors: ['SANTE'] })
      : ok({ sector: 'SANTE', configuredSectors: [], sectors: ['SANTE'], locale: 'fr', version: '1.0', items }))
    render(<SectorSuggestionsPanel canCreateProcesses onImported={onImported} />)
    fireEvent.click(screen.getByRole('button', { name: /Suggestions par secteur/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mémoriser ce secteur' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(call => call[1]?.method === 'PUT')).toBe(true))
    expect(onImported).not.toHaveBeenCalled()
  })

  it('affiche la hiérarchie : sous-processus indentés sous leur parent, puis les risques avec le processus concerné', async () => {
    const tree = [
      { key: 'core.risk.leavers', title: 'Un collaborateur parti conserve des accès actifs', kind: 'RISK', sector: 'TRANSVERSAL', processKey: 'core.process.digital.iam', status: 'NEW', packVersion: '1.1' },
      { key: 'core.process.digital.iam', title: 'Gérer les accès et les identités', kind: 'PROCESS', sector: 'TRANSVERSAL', parentKey: 'core.process.digital', status: 'NEW', packVersion: '1.1' },
      { key: 'core.process.buy', title: 'Acheter et piloter les fournisseurs', kind: 'PROCESS', sector: 'TRANSVERSAL', status: 'NEW', packVersion: '1.1' },
      { key: 'core.process.digital', title: 'Exploiter les systèmes et les données', kind: 'PROCESS', sector: 'TRANSVERSAL', status: 'NEW', packVersion: '1.1' },
    ]
    fetchMock.mockImplementation(() => ok({ sector: null, configuredSectors: [], sectors: ['SANTE'], locale: 'fr', version: '1.1', items: tree }))
    render(<SectorSuggestionsPanel canCreateProcesses onImported={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Suggestions par secteur/ }))
    await screen.findByText('Gérer les accès et les identités')
    const rows = screen.getAllByTestId('suggestion-row')
    expect(rows.map(r => r.getAttribute('data-key'))).toEqual(['core.process.buy', 'core.process.digital', 'core.process.digital.iam', 'core.risk.leavers'])
    expect(rows.map(r => r.getAttribute('data-depth'))).toEqual(['0', '0', '1', '0'])
    expect(rows[3]).toHaveTextContent('Gérer les accès et les identités') // processus concerné par le risque
  })
})
