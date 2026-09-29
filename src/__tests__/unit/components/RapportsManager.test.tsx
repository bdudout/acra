import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RapportsManager from '@/components/RapportsManager'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
const ok = (b: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => b } as Response)
const liste = {
  editions: [{ id: 'e1', code: 'R-INC-1', statut: 'VALIDE', periodeDebut: '2026-09-01T00:00:00.000Z', periodeFin: '2026-09-30T00:00:00.000Z', createdAt: '2026-10-01T09:00:00.000Z' }],
  disponibles: [{ code: 'R-INC-1' }, { code: 'R-PER-2' }], canWrite: true,
}
beforeEach(() => {
  fetchMock.mockReset(); push.mockReset()
  fetchMock.mockImplementation((_u: string, init?: RequestInit) => init?.method === 'POST' ? ok({ id: 'e9', code: 'R-PER-2', statut: 'BROUILLON' }, 201) : ok(liste))
  vi.stubGlobal('fetch', fetchMock)
})

describe('RapportsManager', () => {
  it('liste les éditions avec titre du rapport, période et statut, lien vers l’édition', async () => {
    render(<RapportsManager />)
    expect(await screen.findByText('Tableau de bord des incidents')).toBeTruthy()
    expect(screen.getByText('Validé')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ouvrir' }).getAttribute('href')).toBe('/rapports/e1')
  })
  it('génère un brouillon avec période prédéfinie et ouvre l’édition', async () => {
    render(<RapportsManager />)
    fireEvent.click(await screen.findByRole('button', { name: 'Générer un rapport' }))
    fireEvent.change(screen.getByLabelText('Rapport'), { target: { value: 'R-PER-2' } })
    fireEvent.change(screen.getByLabelText('Période'), { target: { value: 'ANNEE_PRECEDENTE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Générer le brouillon' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/rapports/e9'))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'POST')![1].body)
    expect(body.code).toBe('R-PER-2')
    expect(body.periode.debut).toMatch(/^\d{4}-01-01$/)
    expect(body.periode.fin).toMatch(/^\d{4}-12-31$/)
    expect(body.langue).toBe('fr')
  })
  it('sans droit d’écriture : pas de bouton de génération, message explicite', async () => {
    fetchMock.mockImplementation(() => ok({ ...liste, canWrite: false }))
    render(<RapportsManager />)
    await screen.findByText('Tableau de bord des incidents')
    expect(screen.queryByRole('button', { name: 'Générer un rapport' })).toBeNull()
    expect(screen.getByText(/réservées au risk manager/)).toBeTruthy()
  })
})
