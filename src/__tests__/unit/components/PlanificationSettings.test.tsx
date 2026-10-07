import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlanificationSettings from '@/components/PlanificationSettings'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr }) }
})
const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async (_u: string, init?: { method?: string }) => init?.method === 'PUT'
    ? { ok: true, json: async () => ({}) }
    : { ok: true, json: async () => ({ planificationConfig: { modeDefaut: 'FIGE', doubleRegard: false, seuilAnglesMortsAns: 3, AUDIT: { preparateurs: ['AUDITEUR'], validateurs: ['DIRECTION_METIER', 'ADMIN'] }, CONTROLE: { preparateurs: ['CONTROLEUR', 'CONFORMITE'], validateurs: ['RISK_MANAGER', 'RSSI'] } } }) })
})

describe('PlanificationSettings', () => {
  it('affiche les réglages (défauts proposés) et enregistre le mode, le double regard et un validateur ajouté', async () => {
    render(<PlanificationSettings />)
    const mode = await screen.findByLabelText('Mode par défaut des plans')
    expect((mode as HTMLSelectElement).value).toBe('FIGE')
    expect(screen.getByRole('switch', { name: /Double regard/ })).toHaveAttribute('aria-checked', 'false')
    fireEvent.change(mode, { target: { value: 'DYNAMIQUE' } })
    fireEvent.click(screen.getByRole('switch', { name: /Double regard/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Plan d’audit — validateurs : RSSI' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PUT')).toBe(true))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')![1].body)
    expect(body.planificationConfig).toMatchObject({ modeDefaut: 'DYNAMIQUE', doubleRegard: true, AUDIT: { validateurs: ['DIRECTION_METIER', 'ADMIN', 'RSSI'] } })
  })
})
