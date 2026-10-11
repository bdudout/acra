// Recette n° 16 : la démarche Flash étant mémorisée sur l'analyse, le bandeau permet d'en sortir (PATCH false, URL sans ?mode).
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuitterFlashButton from '@/components/QuitterFlashButton'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const replace = vi.fn(); const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }))
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); replace.mockReset(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) }) })

describe('QuitterFlashButton', () => {
  it('désactive la démarche Flash sur l’analyse puis recharge l’atelier sans ?mode=flash', async () => {
    render(<QuitterFlashButton analyseId="a1" atelierNum={2} />)
    fireEvent.click(screen.getByRole('button', { name: 'Quitter la démarche Flash' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/analyses/a1/atelier/2'))
    expect(fetchMock).toHaveBeenCalledWith('/api/analyses/a1', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ demarcheFlash: false }) }))
  })
})
