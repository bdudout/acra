import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SecteursMasquesEditor from '@/components/SecteursMasquesEditor'

vi.mock('@/lib/i18n/context', async () => {
  const { en } = await import('@/lib/i18n/en')
  return { useTranslation: () => ({ t: en, locale: 'en' }) }
})
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('SecteursMasquesEditor', () => {
  it('secteurs cochés = proposés ; décocher masque et enregistre le libellé canonique', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    render(<SecteursMasquesEditor initial={[]} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Banking/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/organization-config')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ secteursMasques: ['Banque / Finance'] })
    expect((screen.getByRole('checkbox', { name: /Banking/ }) as HTMLInputElement).checked).toBe(false)
  })
  it('échec : l’état précédent est rétabli et signalé', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    render(<SecteursMasquesEditor initial={['Banque / Finance']} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Banking/ }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: /Banking/ }) as HTMLInputElement).checked).toBe(false)
  })
})
