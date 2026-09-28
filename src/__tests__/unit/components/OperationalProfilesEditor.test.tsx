import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OperationalProfilesEditor, { type EditorProfile } from '@/components/OperationalProfilesEditor'
import { operationalProfileStats } from '@/lib/operational-profiles'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

function profile(over: Partial<EditorProfile> = {}): EditorProfile {
  const entries = over.entries ?? []
  return {
    framework: 'NIST_CSF_2_0', id: 'p1', cible: null, entries, updatedAt: null,
    stats: operationalProfileStats(entries, 22), actions: {}, actionsOpen: 0, actionsOverdue: 0, ...over,
  }
}

const fetchMock = vi.fn()
const ok = (b: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => b } as Response)
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('OperationalProfilesEditor', () => {
  it('affiche les 22 catégories CSF groupées par fonction avec les intitulés officiels', () => {
    render(<OperationalProfilesEditor canManage profiles={[profile()]} />)
    expect(screen.getByText('Govern')).toBeTruthy()
    expect(screen.getByText('Organizational Context')).toBeTruthy()
    expect(screen.getAllByLabelText(/État courant$/)).toHaveLength(22)
  })

  it('enregistre le profil (points + niveau cible) et reprend l’horodatage serveur', async () => {
    fetchMock.mockReturnValueOnce(ok({ framework: 'NIST_CSF_2_0', cible: 'TIER_3', entries: [{ ref: 'GV.OC', statut: 'NON_COUVERT', updatedAt: '2026-09-28T10:00:00.000Z' }] }))
    render(<OperationalProfilesEditor canManage profiles={[profile()]} />)
    fireEvent.change(screen.getByLabelText('GV.OC État courant'), { target: { value: 'NON_COUVERT' } })
    fireEvent.change(screen.getByLabelText('Niveau cible du profil'), { target: { value: 'TIER_3' } })
    expect(screen.getByText('Modifications non enregistrées')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/operational-profiles')
    expect(init.method).toBe('PUT')
    const body = JSON.parse(init.body)
    expect(body.framework).toBe('NIST_CSF_2_0')
    expect(body.cible).toBe('TIER_3')
    expect(body.entries).toContainEqual(expect.objectContaining({ ref: 'GV.OC', statut: 'NON_COUVERT' }))
    expect(await screen.findByText('Enregistré')).toBeTruthy()
  })

  it('ne propose une action que pour un écart actionnable', () => {
    render(<OperationalProfilesEditor canManage profiles={[profile({ entries: [
      { ref: 'GV.OC', statut: 'NON_COUVERT' },
      { ref: 'GV.RM', statut: 'PARTIEL', cible: 'NON_APPLICABLE' },
      { ref: 'GV.RR', statut: 'COUVERT' },
    ] })]} />)
    expect(screen.getAllByRole('button', { name: 'Créer une action' })).toHaveLength(1)
    expect(within(document.getElementById('op-GV.OC')!).getByRole('button', { name: 'Créer une action' })).toBeTruthy()
  })

  it('signale une action ouverte existante au lieu d’un doublon', async () => {
    fetchMock.mockReturnValueOnce(ok({ id: 'a1', existing: true }))
    render(<OperationalProfilesEditor canManage profiles={[profile({ entries: [{ ref: 'GV.OC', statut: 'NON_COUVERT' }] })]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Créer une action' }))
    expect(await screen.findByText('Une action ouverte existe déjà pour ce point')).toBeTruthy()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/operational-profiles/actions')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ framework: 'NIST_CSF_2_0', ref: 'GV.OC' })
  })

  it('lecture seule : aucun contrôle modifiable ni bouton d’enregistrement', () => {
    render(<OperationalProfilesEditor canManage={false} profiles={[profile({ framework: 'NCSC_CAF_V4', stats: operationalProfileStats([], 14), entries: [{ ref: 'A1', statut: 'NON_COUVERT' }] })]} />)
    expect((screen.getByLabelText('A1 État courant') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Créer une action' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Exporter le bilan (CSV)' }).getAttribute('href')).toBe('/api/operational-profiles/export?framework=NCSC_CAF_V4')
  })

  it('affiche la couverture et les actions liées', () => {
    const entries = [{ ref: 'A1', statut: 'COUVERT' as const }, { ref: 'A2', statut: 'NON_COUVERT' as const }]
    render(<OperationalProfilesEditor canManage profiles={[profile({ framework: 'NCSC_CAF_V4', entries, stats: operationalProfileStats(entries, 14), actions: { A2: { total: 1, open: 1, overdue: 1 } }, actionsOpen: 1, actionsOverdue: 1 })]} />)
    expect(screen.getByText('50 %')).toBeTruthy()
    expect(screen.getAllByText('1 action(s) ouverte(s) · 1 en retard')).toHaveLength(2)
  })
})
