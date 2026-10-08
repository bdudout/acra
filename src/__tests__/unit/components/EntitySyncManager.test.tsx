import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EntitySyncManager from '@/components/EntitySyncManager'

vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ t: { entites: {
  syncTitle: 'External sync', syncDesc: 'Preview safely', syncType: 'Type', syncEndpoint: 'Endpoint', syncToken: 'Token', syncBindDn: 'Bind DN', syncPassword: 'Password', syncBaseDn: 'Base DN', syncFilter: 'Filter', syncSave: 'Save', syncPreview: 'Preview', syncImport: 'Import', syncSelectAll: 'All', syncNone: 'None', syncSaved: 'Saved', syncImported: '{n} imported', syncError: 'Error', syncSourceVerite: 'Source of truth', syncSourceAcra: 'ACRA', syncSourceAnnuaire: 'Directory', syncSourceVeriteAide: 'help',
} } }) }))

describe('EntitySyncManager', () => {
  it('does not import an external entity before the administrator selects it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ type: 'REST', endpoint: 'https://directory.example.test/entities' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entities: ['DSI'], newEntities: ['DSI'] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ imported: ['DSI'] }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<EntitySyncManager orgId="org-1" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByLabelText('DSI')).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'DSI' }))
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'DSI' }))
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[2][1].body).toContain('"entities":["DSI"]')
  })

  it('l’administrateur choisit qui fait foi (ACRA ou l’annuaire) et ce choix est enregistré avec le connecteur', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ type: 'LDAP', endpoint: 'ldaps://d.example.test', sourceVerite: 'ACRA' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ type: 'LDAP', endpoint: 'ldaps://d.example.test', sourceVerite: 'ANNUAIRE' }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<EntitySyncManager orgId="org-1" />)
    await waitFor(() => expect((screen.getByLabelText('Source of truth') as HTMLSelectElement).value).toBe('ACRA'))
    fireEvent.change(screen.getByLabelText('Source of truth'), { target: { value: 'ANNUAIRE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ sourceVerite: 'ANNUAIRE' })
  })
})
