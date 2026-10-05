import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Questionnaire360 from '@/components/projet360/Questionnaire360'
import ImportCyberRisks from '@/components/projet360/ImportCyberRisks'
import Dashboard360 from '@/components/projet360/Dashboard360'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
const ok = (b: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => b } as Response)
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('Questionnaire360', () => {
  it('six domaines, progression, enregistrement des réponses puis risques proposés', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/qualification-360')) return ok({ answers: JSON.parse(String(init?.body)).answers })
      return ok({ channel: 'DIRECT', proposals: [{ id: 'p360-compromissionExpose', title: 'Compromission', mandatory: false, category: 'CYBER', gravity: 3, likelihood: 3, strategy: 'REDUIRE', alreadyCreated: false }] })
    })
    render(<Questionnaire360 analyseId="a1" editable initialAnswers={{ 'p360.cyber.donneesSensibles': false }} />)
    for (const d of ['Cyber', 'IT (architecture, maintenance)', 'Projet', 'Métier', 'Fraude', 'Externalisation']) expect(screen.getByRole('heading', { name: new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeTruthy()
    const q = screen.getByRole('radiogroup', { name: 'Le projet expose-t-il un service sur Internet ?' })
    fireEvent.click(within(q).getByRole('radio', { name: 'Oui' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les réponses' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/analyses/a1/qualification-360', expect.objectContaining({ method: 'PUT' })))
    const body = JSON.parse(fetchMock.mock.calls.find(c => String(c[0]).endsWith('/qualification-360'))![1].body)
    expect(body.answers).toEqual({ 'p360.cyber.donneesSensibles': false, 'p360.cyber.exposeInternet': true })
    expect(await screen.findByRole('button', { name: 'Voir les risques proposés (1)' })).toBeTruthy()
  })

  it('lecture seule : pas de bouton d’enregistrement, choix désactivés', () => {
    fetchMock.mockReturnValue(ok({ proposals: [] }))
    render(<Questionnaire360 analyseId="a1" editable={false} initialAnswers={{}} />)
    expect(screen.queryByRole('button', { name: 'Enregistrer les réponses' })).toBeNull()
    expect((screen.getAllByRole('radio')[0] as HTMLInputElement).disabled).toBe(true)
  })
})

describe('Questionnaire360 — pré-remplissage', () => {
  it('affiche la source des réponses pré-remplies, puis la retire une fois confirmées', async () => {
    fetchMock.mockImplementation((url: string) => ok(url.endsWith('/qualification-360') ? { answers: {} } : { proposals: [] }))
    render(<Questionnaire360 analyseId="a1" editable initialAnswers={{ 'p360.ext.cloud': true }} sources={{ 'p360.ext.cloud': 'cloud' }} />)
    expect(screen.getByText(/Réponses pré-remplies d’après les données de votre organisation/)).toBeTruthy()
    expect(screen.getByText(/registre TIC : service cloud ou d’hébergement/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les réponses' }))
    await waitFor(() => expect(screen.queryByText(/registre TIC : service cloud/)).toBeNull())
  })
})

describe('ImportCyberRisks', () => {
  const sources = { sources: [{ id: 'c1', nom: 'EBIOS SI paie', methode: 'EBIOS_RM', nbRisques: 2, nbTiers: 3 }] }
  const detail = { source: { id: 'c1', nom: 'EBIOS SI paie', methode: 'EBIOS_RM', nbTiers: 3, risques: [
    { id: 's1', nom: 'Rançongiciel', niveauRisque: 12, alreadyImported: false },
    { id: 's2', nom: 'Fuite', niveauRisque: 6, alreadyImported: true },
  ] } }
  const route = (body: unknown) => (url: string, init?: RequestInit) => init?.method === 'POST' ? ok(body, 201) : ok(url.includes('source=') ? detail : sources)

  it('recherche une analyse, importe la sélection et ses tiers, puis propose de voir les risques', async () => {
    fetchMock.mockImplementation(route({ imported: 1, tiers: 3 }))
    const onImported = vi.fn(); const onVoirRisques = vi.fn()
    render(<ImportCyberRisks analyseId="a1" onImported={onImported} onVoirRisques={onVoirRisques} />)
    expect(screen.getByRole('heading', { name: 'Importer des risques cyber ou des tiers d’une analyse cyber' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Rechercher une analyse cyber'), { target: { value: 'paie' } })
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]).includes('q=paie'))).toBe(true))
    fireEvent.change(await screen.findByLabelText('Analyse source'), { target: { value: 'c1' } })
    expect(((await screen.findByRole('checkbox', { name: /Fuite/ })) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('checkbox', { name: 'Importer aussi les tiers de l’analyse (3)' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /Rançongiciel/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Importer la sélection' }))
    await waitFor(() => expect(onImported).toHaveBeenCalled())
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toEqual({ sourceAnalyseId: 'c1', risqueIds: ['s1'], importerTiers: true })
    expect(await screen.findByText('1 risque(s) et 3 tiers importé(s).')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Voir les risques importés' }))
    expect(onVoirRisques).toHaveBeenCalled()
  })
  it('import des tiers seuls possible ; décocher les tiers les exclut', async () => {
    fetchMock.mockImplementation(route({ imported: 0, tiers: 3 }))
    render(<ImportCyberRisks analyseId="a1" />)
    fireEvent.change(await screen.findByLabelText('Analyse source'), { target: { value: 'c1' } })
    await screen.findByRole('checkbox', { name: /Rançongiciel/ })
    const btn = screen.getByRole('button', { name: 'Importer la sélection' }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    fireEvent.click(screen.getByRole('checkbox', { name: /Importer aussi les tiers/ }))
    expect(btn.disabled).toBe(true)
  })
})

describe('Dashboard360', () => {
  it('une carte par domaine avec nombre, niveaux, dépassements et principaux risques', async () => {
    fetchMock.mockReturnValue(ok({ risques: [
      { id: 'r1', nom: 'Rançongiciel', domaine: 'CYBER', niveauRisque: 16, niveauResiduel: 8 },
      { id: 'r2', nom: 'Faux virement', domaine: 'FRAUD', niveauRisque: 9, niveauResiduel: null },
      { id: 'r3', nom: 'Sans domaine', domaine: null, niveauRisque: 4, niveauResiduel: null },
    ] }))
    render(<Dashboard360 analyseId="a1" appetitSeuil={8} answers={{ 'p360.cyber.exposeInternet': true }} />)
    const cyber = await screen.findByRole('region', { name: 'Cyber' })
    expect(within(cyber).getByText('Rançongiciel')).toBeTruthy()
    expect(within(cyber).getAllByText('16')).toHaveLength(2) // niveau brut max. + principal risque
    const fraud = screen.getByRole('region', { name: 'Fraude' })
    expect(within(fraud).getByText('Faux virement')).toBeTruthy()
    expect(screen.getByText('1 risque(s) sans domaine')).toBeTruthy()
  })
})
