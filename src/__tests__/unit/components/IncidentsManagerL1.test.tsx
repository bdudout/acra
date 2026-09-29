import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IncidentsManager from '@/components/IncidentsManager'
import { resolveIncidentsConfig } from '@/lib/incidents-config'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('@/components/AutocompleteInput', () => ({ default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => <input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} /> }))

const cfg = resolveIncidentsConfig({ regimes: [{ code: 'NIS2', actif: true }], seuilGrandePerte: 5000 })
const incident = {
  id: 'i1', intitule: 'Rançongiciel sur le SI de paie', description: null, dateSurvenance: '2026-09-28T00:00:00.000Z', dateDetection: '2026-09-29T08:00:00.000Z',
  taxonomieCode: null, processusId: null, processusNom: null, entite: null, impactEstime: 3, montantBrut: 7000, recuperations: 1000, perteNette: 6000, delaiDetection: 1,
  riskItemId: null, riskItemIntitule: null, statut: 'DECLARE', createdAt: '2026-09-29T09:00:00.000Z',
  typeEvenement: 'CYBER', quasiIncident: false, attributs: { significatif: true }, dateReglement: null,
  pertes: [{ type: 'PERTE_DIRECTE', montant: 7000, devise: 'EUR', statut: 'ESTIME' }], recuperationsLignes: [{ type: 'ASSURANCE', montant: 1000, devise: 'EUR' }],
  l1: {
    horloges: [{ regime: 'NIS2', labelKey: 'notifRegimes.NIS2.label', phases: [{ code: 'ALERTE_PRECOCE', labelKey: 'notifRegimes.NIS2.phases.ALERTE_PRECOCE', echeance: '2026-09-30T08:00:00.000Z', statut: 'EN_RETARD', soumisLe: null, tardive: false }] }],
    nbEnRetard: 1, totaux: { net: 6000 }, seuils: { collectee: true, grandePerte: true },
  },
}
const fetchMock = vi.fn()
const ok = (b: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => b } as Response)
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === '/api/incidents' && !init?.method) return ok({ incidents: [incident], active: true, config: cfg })
    if (url === '/api/taxonomie') return ok({ taxonomie: [] })
    if (url === '/api/processus') return ok({ processus: [] })
    if (url === '/api/risk-items') return ok({ risks: [] })
    return ok({ ok: true })
  })
  vi.stubGlobal('fetch', fetchMock)
})

describe('IncidentsManager — lot L1', () => {
  it('affiche type, grande perte et retards de notification ; ouvre les horloges', async () => {
    render(<IncidentsManager canQualify canConfigure />)
    expect(await screen.findByText('Rançongiciel sur le SI de paie')).toBeTruthy()
    expect(screen.getByText('Cyber / sécurité de l’information')).toBeTruthy()
    expect(screen.getByText('Grande perte')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /1 en retard/ }))
    expect(await screen.findByText('NIS2 — Directive (UE) 2022/2555, art. 23')).toBeTruthy()
    expect(screen.getByText('Alerte précoce')).toBeTruthy()
  })
  it('marquer une phase soumise appelle l’API de notifications avec la référence', async () => {
    render(<IncidentsManager canQualify />)
    fireEvent.click(await screen.findByRole('button', { name: /1 en retard/ }))
    fireEvent.change(await screen.findByLabelText('Référence de l’accusé (facultatif)'), { target: { value: 'ANSSI-7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Marquer comme soumise' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[0] === '/api/incidents/i1/notifications' && c[1]?.method === 'POST')).toBe(true))
    const call = fetchMock.mock.calls.find(c => c[0] === '/api/incidents/i1/notifications')!
    expect(JSON.parse(call[1].body)).toEqual({ regime: 'NIS2', phase: 'ALERTE_PRECOCE', reference: 'ANSSI-7' })
  })
  it('la déclaration transmet le type d’événement, les obligations et le quasi-incident', async () => {
    render(<IncidentsManager canQualify />)
    await screen.findByText('Rançongiciel sur le SI de paie')
    fireEvent.click(screen.getByRole('button', { name: '+ Déclarer un incident' }))
    fireEvent.change(screen.getByPlaceholderText('Que s\'est-il passé ?'), { target: { value: 'Clé USB trouvée' } })
    fireEvent.change(screen.getByLabelText('Type d’événement'), { target: { value: 'CYBER' } })
    fireEvent.click(screen.getByLabelText('Données personnelles concernées'))
    fireEvent.click(screen.getByLabelText('Quasi-incident (aucune perte réalisée)'))
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST' && c[0] === '/api/incidents')).toBe(true))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'POST' && c[0] === '/api/incidents')![1].body)
    expect(body).toMatchObject({ typeEvenement: 'CYBER', quasiIncident: true, attributs: { donneesPersonnelles: true, significatif: false } })
  })
  it('la qualification envoie les lignes de perte et de récupération', async () => {
    render(<IncidentsManager canQualify />)
    const ligne = (await screen.findByText('Rançongiciel sur le SI de paie')).closest('tr')!
    fireEvent.click(within(ligne).getByRole('button', { name: 'Qualifier' }))
    fireEvent.change(await screen.findByLabelText('Montant — perte 1'), { target: { value: '8000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PATCH')).toBe(true))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')![1].body)
    expect(body.pertes).toEqual([{ type: 'PERTE_DIRECTE', montant: 8000, devise: 'EUR', statut: 'ESTIME' }])
    expect(body.recuperationsLignes).toEqual([{ type: 'ASSURANCE', montant: 1000, devise: 'EUR' }])
    expect(body.attributs).toMatchObject({ significatif: true })
  })
  it('la configuration n’est proposée qu’à l’administrateur', async () => {
    const { unmount } = render(<IncidentsManager canQualify canConfigure={false} />)
    await screen.findByText('Rançongiciel sur le SI de paie')
    expect(screen.queryByRole('button', { name: 'Configuration' })).toBeNull()
    unmount()
    render(<IncidentsManager canQualify canConfigure />)
    fireEvent.click(await screen.findByRole('button', { name: 'Configuration' }))
    expect(await screen.findByText('Configuration « Incidents & pertes »')).toBeTruthy()
  })
})
