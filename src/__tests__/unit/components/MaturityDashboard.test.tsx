import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MaturityDashboard, { type MaturityDashboardProps } from '@/components/MaturityDashboard'
import { maturityStats, MATURITY_LEVELS } from '@/lib/maturity'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

const items = [
  { ref: 'A1', nom: 'Governance', description: 'Gov', categorie: 'A' },
  { ref: 'A2', nom: 'Risk Management', description: 'Risk', categorie: 'A' },
  { ref: 'B1', nom: 'Service protection', description: 'Prot', categorie: 'B' },
]
const scale = MATURITY_LEVELS.map(n => ({ niveau: n, libelle: `Niv${n}`, definition: `Déf ${n}` }))

function props(over: Partial<MaturityDashboardProps['profile']> = {}, canManage = true): MaturityDashboardProps {
  const maturites = over.maturites ?? { A1: { actuel: 1 }, A2: { actuel: 3 } }
  const maturiteCible = over.maturiteCible === undefined ? 3 : over.maturiteCible
  return {
    canManage, scale,
    referentiels: [{ code: 'NCSC_CAF', nom: 'NCSC CAF (v4.0)' }, { code: 'NIST_CSF', nom: 'NIST CSF (2.0)' }],
    profile: {
      referentiel: 'NCSC_CAF', conformiteId: 'c1', items, categories: { A: 'A — Managing security risk', B: 'B — Protecting' },
      maturites, maturiteCible, conformite: { A1: 'partiel' }, actions: {}, updatedAt: null,
      stats: maturityStats(items, maturites, maturiteCible), ...over,
    },
  }
}

const fetchMock = vi.fn()
const ok = (b: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => b } as Response)
beforeEach(() => { fetchMock.mockReset(); push.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('MaturityDashboard', () => {
  it('tableau de bord : moyennes, points sous la cible, domaines et plus grands écarts', () => {
    render(<MaturityDashboard {...props()} />)
    expect(screen.getByText('2 / 5')).toBeTruthy() // moyenne actuelle (1+3)/2
    expect(screen.getByText('3 / 5')).toBeTruthy() // moyenne cible
    expect(screen.getByText('1 / 2')).toBeTruthy() // sous la cible / évalués
    const gaps = screen.getByRole('list', { name: 'Plus grands écarts' })
    expect(within(gaps).getByText(/A1/)).toBeTruthy()
    expect(within(gaps).queryByText(/A2/)).toBeNull()
    expect(screen.getAllByText('A — Managing security risk').length).toBeGreaterThan(0)
  })

  it('affiche la conformité du même point à côté (couche indépendante)', () => {
    render(<MaturityDashboard {...props()} />)
    const row = document.getElementById('mat-A1')!
    expect(within(row).getByText('Partiel')).toBeTruthy()
  })

  it('enregistre la maturité et la cible globale (PUT /api/maturite)', async () => {
    fetchMock.mockReturnValueOnce(ok({ maturites: { A1: { actuel: 2, updatedAt: '2026-09-29T10:00:00.000Z' }, A2: { actuel: 3 } }, maturiteCible: 4 }))
    render(<MaturityDashboard {...props()} />)
    fireEvent.change(screen.getByLabelText('A1 Maturité actuelle'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Niveau cible global'), { target: { value: '4' } })
    expect(screen.getByText('Modifications non enregistrées')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/maturite')
    expect(init.method).toBe('PUT')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ referentiel: 'NCSC_CAF', maturiteCible: 4 })
    expect(body.maturites.A1).toEqual({ actuel: 2 })
    expect(await screen.findByText('Enregistré')).toBeTruthy()
  })

  it('cible par point : « = cible globale » par défaut, surcharge possible', () => {
    render(<MaturityDashboard {...props()} />)
    const select = screen.getByLabelText('A1 Maturité cible') as HTMLSelectElement
    expect(select.value).toBe('')
    expect(within(select).getByRole('option', { name: '= cible globale (3 — Niv3)' })).toBeTruthy()
  })

  it('action proposée seulement pour un écart ; action existante signalée', async () => {
    fetchMock.mockReturnValueOnce(ok({ id: 'x', existing: true }))
    render(<MaturityDashboard {...props()} />)
    const buttons = screen.getAllByRole('button', { name: 'Créer une action' })
    // A1 (1 < 3) : dans la liste des écarts ET dans le détail ; A2 (3 = 3) : aucun.
    expect(within(document.getElementById('mat-A2')!).queryByRole('button', { name: 'Créer une action' })).toBeNull()
    fireEvent.click(buttons[0])
    expect(await screen.findByText('Une action ouverte existe déjà pour ce point')).toBeTruthy()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ referentiel: 'NCSC_CAF', ref: 'A1' })
  })

  it('changer de référentiel navigue vers ?referentiel=', () => {
    render(<MaturityDashboard {...props()} />)
    fireEvent.change(screen.getByLabelText('Référentiel'), { target: { value: 'NIST_CSF' } })
    expect(push).toHaveBeenCalledWith('/maturite?referentiel=NIST_CSF')
  })

  it('pour le CAF, renvoie vers les tableaux IGP officiels du NCSC sans présenter une cible ACRA comme normative', () => {
    render(<MaturityDashboard {...props()} />)
    const source = screen.getByRole('link', { name: 'Consulter les tableaux IGP officiels du NCSC' })
    expect(source.getAttribute('href')).toBe('https://www.ncsc.gov.uk/files/NCSC-Cyber-Assessment-Framework-4.0.pdf')
    expect(screen.getByText(/profil cible est à définir par l’autorité de supervision/i)).toBeTruthy()
  })

  it('lecture seule : contrôles désactivés, pas d’enregistrement ni d’action', () => {
    render(<MaturityDashboard {...props({}, false)} />)
    expect((screen.getByLabelText('A1 Maturité actuelle') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Créer une action' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Exporter (CSV)' }).getAttribute('href')).toBe('/api/maturite/export?referentiel=NCSC_CAF')
  })
})
