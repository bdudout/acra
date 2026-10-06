import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CorbeilleElements from '@/components/CorbeilleElements'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }); vi.stubGlobal('fetch', fetchMock) })

describe('CorbeilleElements', () => {
  const elements = [{ id: 'c1', type: 'INCIDENT', intitule: 'Panne du portail', supprimeLe: '2026-10-06T10:00:00.000Z', daysRemaining: 30 }]
  it('liste les incidents supprimés ; restaurer après confirmation retire la ligne', async () => {
    render(<CorbeilleElements initial={elements} />)
    const region = screen.getByRole('region', { name: 'Incidents supprimés' })
    expect(within(region).getByText('Panne du portail')).toBeTruthy()
    fireEvent.click(within(region).getByRole('button', { name: /Restaurer/ }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Restaurer/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/recovery/elements/c1', { method: 'PATCH' }))
    await waitFor(() => expect(within(region).queryByText('Panne du portail')).toBeNull())
  })
  it('vide : message', () => {
    render(<CorbeilleElements initial={[]} />)
    expect(screen.getByText('Aucun incident supprimé.')).toBeTruthy()
  })
})
