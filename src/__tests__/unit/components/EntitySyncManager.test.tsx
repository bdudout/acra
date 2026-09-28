import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EntitySyncManager from '@/components/EntitySyncManager'

vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ t: { entites: {
  syncTitle: 'External sync', syncDesc: 'Preview safely', syncType: 'Type', syncEndpoint: 'Endpoint', syncToken: 'Token', syncBindDn: 'Bind DN', syncPassword: 'Password', syncBaseDn: 'Base DN', syncFilter: 'Filter', syncSave: 'Save', syncPreview: 'Preview', syncImport: 'Import', syncSelectAll: 'All', syncNone: 'None', syncSaved: 'Saved', syncImported: '{n} imported', syncError: 'Error',
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
})
