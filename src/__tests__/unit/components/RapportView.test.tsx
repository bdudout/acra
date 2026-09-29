import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RapportView from '@/components/RapportView'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const edition = (o = {}) => ({
  id: 'e1', code: 'R-INC-1', statut: 'BROUILLON', periodeDebut: '2026-09-01T00:00:00.000Z', periodeFin: '2026-09-30T00:00:00.000Z', createdById: 'u1', canWrite: true, destinataires: [],
  contenu: { code: 'R-INC-1', periode: { debut: '2026-09-01', fin: '2026-09-30' }, genereLe: '2026-10-02T12:00:00.000Z', deviseReference: 'EUR', sections: [
    { id: 'synthese', blocs: [{ type: 'kpis', items: [{ cle: 'total', valeur: 3 }, { cle: 'net', valeur: 5250, unite: 'devise' }] }] },
    { id: 'notifsEnRetard', blocs: [{ type: 'tableau', colonnes: ['rapports.cols.incident', 'rapports.cols.regime'], lignes: [['Incident a', { k: 'notifRegimes.NIS2.label' }]] }] },
  ] }, ...o,
})
const fetchMock = vi.fn()
const ok = (b: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => b } as Response)
beforeEach(() => { fetchMock.mockReset(); push.mockReset(); vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('confirm', () => true) })

describe('RapportView', () => {
  it('affiche titre, période, statut, indicateurs et tableaux avec libellés traduits', async () => {
    fetchMock.mockImplementation(() => ok(edition()))
    render(<RapportView id="e1" />)
    expect(await screen.findByRole('heading', { name: 'Tableau de bord des incidents' })).toBeTruthy()
    expect(screen.getByText('Brouillon')).toBeTruthy()
    expect(screen.getByText('Synthèse')).toBeTruthy()
    expect(screen.getByText('Incidents')).toBeTruthy()
    expect(screen.getByText('NIS2 — Directive (UE) 2022/2555, art. 23')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Exporter (Excel)' }).getAttribute('href')).toBe('/api/rapports/e1/export?lang=fr')
  })
  it('brouillon : relire, régénérer, supprimer ; le PATCH envoie l’action', async () => {
    fetchMock.mockImplementation(() => ok(edition()))
    render(<RapportView id="e1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Marquer comme relu' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PATCH')).toBe(true))
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')![1].body)).toEqual({ action: 'RELU' })
    expect(screen.getByRole('button', { name: 'Régénérer' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeTruthy()
  })
  it('validé : édition figée, ni régénération ni suppression ; diffusion avec destinataires', async () => {
    fetchMock.mockImplementation(() => ok(edition({ statut: 'VALIDE' })))
    render(<RapportView id="e1" />)
    expect(await screen.findByText('Édition figée — non recalculée')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Régénérer' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Destinataires (séparés par des virgules)'), { target: { value: 'Comité des risques, Direction' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consigner la diffusion' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PATCH')).toBe(true))
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')![1].body)).toEqual({ action: 'DIFFUSE', destinataires: ['Comité des risques', 'Direction'] })
  })
  it('lecture seule : aucune action de cycle', async () => {
    fetchMock.mockImplementation(() => ok(edition({ canWrite: false })))
    render(<RapportView id="e1" />)
    await screen.findByRole('heading', { name: 'Tableau de bord des incidents' })
    expect(screen.queryByRole('button', { name: 'Marquer comme relu' })).toBeNull()
  })
  it('erreur quatre-yeux affichée', async () => {
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => init?.method === 'PATCH'
      ? Promise.resolve({ ok: false, status: 400, json: async () => ({ error: 'quatre_yeux' }) } as Response) : ok(edition()))
    render(<RapportView id="e1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Marquer comme relu' }))
    expect(await screen.findByText(/ne peut pas la relire ni la valider/)).toBeTruthy()
  })
})
