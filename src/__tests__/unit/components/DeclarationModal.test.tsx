import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DeclarationModal, { type DeclarationIncidentView } from '@/components/DeclarationModal'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
const ok = (body: unknown = {}) => Promise.resolve({ ok: true, status: 200, json: async () => body } as Response)
const incident: DeclarationIncidentView = {
  id: 'i1', intitule: 'Rançongiciel sur le SI', attributs: { significatif: true },
  dora: { classe: 'MAJEUR', echeances: [
    { phase: 'INITIALE', echeance: '2026-10-05T11:00:00.000Z', statut: 'A_FAIRE', soumiseLe: null },
    { phase: 'INTERMEDIAIRE', echeance: null, statut: 'A_FAIRE', soumiseLe: null },
    { phase: 'FINALE', echeance: null, statut: 'A_FAIRE', soumiseLe: null },
  ] },
  horloges: [{ regime: 'NIS2', labelKey: 'notifRegimes.NIS2.label', phases: [
    { code: 'ALERTE_PRECOCE', labelKey: 'notifRegimes.NIS2.phases.ALERTE_PRECOCE', echeance: '2026-10-06T07:00:00.000Z', statut: 'A_FAIRE' as const, soumisLe: null, tardive: false },
    { code: 'NOTIFICATION', labelKey: 'notifRegimes.NIS2.phases.NOTIFICATION', echeance: '2026-10-08T07:00:00.000Z', statut: 'SOUMIS' as const, soumisLe: '2026-10-05T12:00:00.000Z', reference: 'ANSSI-42', tardive: false },
  ] }],
}
const available = [{ code: 'NIS2', labelKey: 'notifRegimes.NIS2.label' }, { code: 'CRA_14', labelKey: 'notifRegimes.CRA_14.label' }, { code: 'SEC_8K', labelKey: 'notifRegimes.SEC_8K.label' }]
const props = (extra = {}) => ({ incident, available, canQualify: true, onClose: vi.fn(), onChanged: vi.fn(), ...extra })

beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation((url: string, init?: RequestInit) => (!init?.method || init.method === 'GET') && String(url).endsWith('/declaration') ? ok({ declaration: { '2.7': 'Supervision' } }) : ok({}))
})
const calls = (method: string) => fetchMock.mock.calls.filter(c => c[1]?.method === method)

describe('DeclarationModal', () => {
  it('liste DORA (3 étapes) et chaque régime avec échéances et statuts ; export JSON par phase', () => {
    render(<DeclarationModal {...props()} />)
    const dora = screen.getByRole('region', { name: /DORA — déclaration d’incident majeur/ })
    expect(within(dora).getByText('Notification initiale')).toBeInTheDocument(); expect(within(dora).getByText('Rapport final')).toBeInTheDocument()
    expect(within(dora).getByRole('link', { name: /Exporter le JSON — Rapport intermédiaire/ })).toHaveAttribute('href', '/api/incidents/i1/declaration?regime=DORA&stage=INTERMEDIATE&download=1')
    const nis2 = screen.getByRole('region', { name: /NIS2/ })
    expect(within(nis2).getByText('Alerte précoce')).toBeInTheDocument(); expect(within(nis2).getByText(/ANSSI-42/)).toBeInTheDocument()
    expect(within(nis2).getAllByRole('link', { name: 'Exporter le JSON' })[0]).toHaveAttribute('href', '/api/incidents/i1/declaration?regime=NIS2&phase=ALERTE_PRECOCE&download=1')
  })
  it('case « formalisée en interne » d’une phase de régime : enregistre avec la date choisie et la référence ; décocher retire la soumission', async () => {
    const onChanged = vi.fn()
    render(<DeclarationModal {...props({ onChanged })} />)
    const nis2 = screen.getByRole('region', { name: /NIS2/ })
    fireEvent.change(within(nis2).getByLabelText(/Date et heure du dépôt — Alerte précoce/), { target: { value: '2026-10-05T14:30' } })
    fireEvent.change(within(nis2).getAllByPlaceholderText('Référence de l’accusé')[0], { target: { value: 'ANSSI-7' } })
    fireEvent.click(within(nis2).getByRole('checkbox', { name: /Formalisée en interne — Alerte précoce/ }))
    await waitFor(() => expect(calls('POST')).toHaveLength(1))
    const body = JSON.parse(calls('POST')[0][1].body)
    expect(calls('POST')[0][0]).toBe('/api/incidents/i1/notifications')
    expect(body).toMatchObject({ regime: 'NIS2', phase: 'ALERTE_PRECOCE', reference: 'ANSSI-7' })
    expect(new Date(body.soumisLe).getTime()).toBe(new Date('2026-10-05T14:30').getTime())
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    fireEvent.click(within(nis2).getByRole('checkbox', { name: /Formalisée en interne — Notification d’incident/ }))
    await waitFor(() => expect(calls('DELETE')).toHaveLength(1))
    expect(JSON.parse(calls('DELETE')[0][1].body)).toEqual({ regime: 'NIS2', phase: 'NOTIFICATION' })
  })
  it('DORA : cocher la phase enregistre l’horodatage du dépôt ; décocher le remet à null', async () => {
    render(<DeclarationModal {...props()} />)
    const dora = screen.getByRole('region', { name: /DORA/ })
    fireEvent.click(within(dora).getAllByRole('checkbox')[0])
    await waitFor(() => expect(calls('PATCH')).toHaveLength(1))
    expect(calls('PATCH')[0][0]).toBe('/api/incidents/i1')
    expect(Object.keys(JSON.parse(calls('PATCH')[0][1].body))).toEqual(['doraInitialeSoumiseLe'])
    expect(typeof JSON.parse(calls('PATCH')[0][1].body).doraInitialeSoumiseLe).toBe('string')
  })
  it('compléments ITS : champs de l’annexe I de l’étape, valeurs existantes préremplies, enregistrement PUT', async () => {
    render(<DeclarationModal {...props()} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Compléter les champs' })[0])
    const field = await screen.findByLabelText(/2\.7 Discovery of the major ICT-related incident/)
    await waitFor(() => expect(field).toHaveValue('Supervision'))
    fireEvent.change(screen.getByLabelText(/2\.9 Activation of business continuity plan/), { target: { value: 'PCA activé à 09 h' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les compléments' }))
    await waitFor(() => expect(calls('PUT')).toHaveLength(1))
    expect(JSON.parse(calls('PUT')[0][1].body).declaration).toMatchObject({ '2.7': 'Supervision', '2.9': 'PCA activé à 09 h' })
    expect(await screen.findByRole('status')).toHaveTextContent('Compléments enregistrés')
  })
  it('ajouter un régulateur activé dans la configuration : ajouté aux régimes de l’incident (attributs.regimes)', async () => {
    render(<DeclarationModal {...props()} />)
    const select = screen.getByLabelText('Ajouter un régulateur ou une autorité')
    expect(within(select).queryByRole('option', { name: /NIS2 —/ })).not.toBeInTheDocument() // déjà applicable
    fireEvent.change(select, { target: { value: 'CRA_14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    await waitFor(() => expect(calls('PATCH')).toHaveLength(1))
    expect(JSON.parse(calls('PATCH')[0][1].body)).toEqual({ attributs: { significatif: true, regimes: ['CRA_14'] } })
  })
  it('lecture seule : aucune case, aucun export, aucun ajout', () => {
    render(<DeclarationModal {...props({ canQualify: false })} />)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0); expect(screen.queryAllByRole('link')).toHaveLength(0); expect(screen.queryByLabelText('Ajouter un régulateur ou une autorité')).not.toBeInTheDocument()
  })
})
