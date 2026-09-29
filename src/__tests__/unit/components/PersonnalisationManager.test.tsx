import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PersonnalisationManager from '@/components/PersonnalisationManager'

const reload = vi.fn()
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr', reloadVocabulaire: reload }) }
})

const fetchMock = vi.fn()
const ok = (b: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => b } as Response)
const initial = { vocabulaire: { incident: { '*': 'Événements' } }, champs: { incident: [{ code: 'ticket', label: 'Ticket ITSM', type: 'TEXTE' }] }, canEdit: true }
beforeEach(() => {
  fetchMock.mockReset(); reload.mockReset()
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === '/api/personnalisation/gabarit') return ok(init?.body && JSON.parse(String(init.body)).dryRun ? { changements: [{ type: 'MODULE', cle: 'incidentsActive', avant: false, apres: true }, { type: 'REGIME', cle: 'RGPD_33', avant: false, apres: true }] } : { changements: [] })
    return ok(initial)
  })
  vi.stubGlobal('fetch', fetchMock)
})

describe('PersonnalisationManager', () => {
  it('édite le vocabulaire (libellé général) et enregistre ; recharge le vocabulaire de l’application', async () => {
    render(<PersonnalisationManager />)
    const champ = await screen.findByLabelText('Incidents — Libellé (toutes langues)')
    expect((champ as HTMLInputElement).value).toBe('Événements')
    fireEvent.change(screen.getByLabelText('KRI — Libellé (toutes langues)'), { target: { value: 'Indicateurs clés' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PUT')).toBe(true))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')![1].body)
    expect(body.vocabulaire).toMatchObject({ incident: { '*': 'Événements' }, kri: { '*': 'Indicateurs clés' } })
    await waitFor(() => expect(reload).toHaveBeenCalled())
  })
  it('ajoute un champ personnalisé (liste avec options, requis) puis enregistre', async () => {
    render(<PersonnalisationManager />)
    await screen.findByLabelText('Incidents — Libellé (toutes langues)')
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un champ — Incidents' }))
    const labels = screen.getAllByLabelText('Libellé')
    fireEvent.change(labels[labels.length - 1], { target: { value: 'Urgence métier' } })
    const types = screen.getAllByLabelText('Type')
    fireEvent.change(types[types.length - 1], { target: { value: 'LISTE' } })
    fireEvent.change(screen.getByLabelText('Options (séparées par des virgules)'), { target: { value: 'Basse, Haute' } })
    fireEvent.click(screen.getAllByLabelText('Requis').at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PUT')).toBe(true))
    const inc = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')![1].body).champsPersonnalises.incident
    expect(inc).toHaveLength(2)
    expect(inc[1]).toMatchObject({ label: 'Urgence métier', type: 'LISTE', options: ['Basse', 'Haute'], requis: true })
    expect(inc[1].code).toMatch(/^[a-z][a-z0-9_]*$/)
  })
  it('gabarit : aperçu des changements puis application', async () => {
    render(<PersonnalisationManager />)
    await screen.findByLabelText('Incidents — Libellé (toutes langues)')
    fireEvent.change(screen.getByLabelText('Choisir un gabarit'), { target: { value: 'SANTE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    const liste = await screen.findByRole('list', { name: 'Changements' })
    expect(within(liste).getByText(/Incidents & pertes/)).toBeTruthy()
    expect(within(liste).getByText(/RGPD_33/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer le gabarit' }))
    await waitFor(() => expect(fetchMock.mock.calls.filter(c => c[0] === '/api/personnalisation/gabarit' && !JSON.parse(String(c[1].body)).dryRun)).toHaveLength(1))
  })
  it('sans droit d’édition : message et aucun bouton', async () => {
    fetchMock.mockImplementation(() => ok({ ...initial, canEdit: false }))
    render(<PersonnalisationManager />)
    expect(await screen.findByText(/Réservé à l’administrateur/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
  })
})
