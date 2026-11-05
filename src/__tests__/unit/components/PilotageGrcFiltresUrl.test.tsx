// Pilotage GRC — les filtres sont lus depuis l'URL et écrits dans l'URL (router.replace).
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ params: new URLSearchParams('tab=x&statut=OUVERT'), replace: vi.fn() }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => nav.params,
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/pilotage',
}))
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/components/NouvelleAnalyseMenu', () => ({ default: () => null }))
vi.mock('@/components/ProjetsSuivi', () => ({ default: () => null }))
vi.mock('@/components/HeatmapGridHtml', () => ({ default: () => null }))

import PilotageGrc from '@/components/PilotageGrc'

const ok = (b: unknown) => Promise.resolve({ ok: true, json: async () => b })
beforeEach(() => {
  nav.replace.mockClear()
  const vide = { total: 0, eleve: 0, moyen: 0, faible: 0, nonCote: 0 }
  const actions = { total: 0, faits: 0, enCours: 0, aFaire: 0, enRetard: 0, tauxAvancement: 0 }
  const rollup = { active: true, orgCount: 1, modules: { incidents: false, controles: false, audit: false, appetit: false, kri: false, reglementaire: true }, consolide: { risques: vide, actions }, parOrg: [] }
  vi.stubGlobal('fetch', vi.fn((url: string) => ok(url.startsWith('/api/grc/rollup') ? rollup : { taxonomie: [], processus: [], risks: [], entites: [] })))
})

describe('PilotageGrc — filtres dans l\'URL', () => {
  it('applique les filtres de l\'URL à l\'ouverture', async () => {
    render(<PilotageGrc />)
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(c => String(c[0]) === '/api/grc/rollup?statut=OUVERT')).toBe(true))
  })
  it('un changement de filtre met l\'URL à jour sans perdre les autres paramètres', async () => {
    render(<PilotageGrc />)
    const niveau = await screen.findByLabelText(/niveau/i)
    fireEvent.change(niveau, { target: { value: 'eleve' } })
    expect(nav.replace).toHaveBeenLastCalledWith('/pilotage?tab=x&statut=OUVERT&niveau=eleve', { scroll: false })
  })
})
