// Lot V1 : préconisations en liste paginée côté serveur (état dans l'URL, deep-link ?preconisation=<id>).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const nav = vi.hoisted(() => {
  let params = new URLSearchParams()
  const abonnes = new Set<() => void>()
  return { get: () => params, set: (q: string) => { params = new URLSearchParams(q); abonnes.forEach(f => f()) }, abonnes, replace: vi.fn() }
})
vi.mock('next/navigation', async () => {
  const React = await import('react')
  return {
    useSearchParams: () => React.useSyncExternalStore(cb => { nav.abonnes.add(cb); return () => { nav.abonnes.delete(cb) } }, nav.get),
    useRouter: () => ({ replace: (url: string, o?: unknown) => { nav.replace(url, o); nav.set(url.split('?')[1] ?? '') } }),
    usePathname: () => '/controles/questionnaires',
  }
})
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

import PreconisationsPanel from '@/components/questionnaires/PreconisationsPanel'

const preco = (id: string) => ({ id, intitule: `Préco ${id}`, recommandation: null, criticite: null, statut: 'OUVERT', responsableAction: null, responsableId: null, echeance: null, referentielCode: null, exigenceRef: null, riskItemId: null, reponseId: null, acceptationJustification: null, reports: [], plansAction: [] })
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  nav.replace.mockClear()
  fetchMock = vi.fn(async (url: string, opts?: { method?: string }) => {
    if (opts?.method === 'POST') return { ok: true, json: async () => ({}) }
    const sp = new URLSearchParams(url.split('?')[1])
    const page = sp.get('preconisation') === 'p30' ? 2 : Number(sp.get('page'))
    const ids = page === 2 ? ['p25', 'p30'] : ['p1', 'p2']
    return { ok: true, json: async () => ({ preconisations: ids.map(preco), canDefine: false, pagination: { page, taille: 25, total: 27, pages: 2 } }) }
  })
  vi.stubGlobal('fetch', fetchMock)
})

describe('PreconisationsPanel (liste paginée côté serveur)', () => {
  it('charge la page 1 paginée, affiche la barre de pagination et change de page par l\'URL', async () => {
    nav.set('')
    render(<PreconisationsPanel conformiteActive={false} focusId={null} />)
    expect(await screen.findByText('Préco p1')).toBeTruthy()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/preconisations?page=1')
    expect(screen.getByText('Page 1 sur 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Suivante' }))
    expect(nav.replace).toHaveBeenLastCalledWith('/controles/questionnaires?page=2', { scroll: false })
    expect(await screen.findByText('Préco p30')).toBeTruthy()
  })

  it('deep-link : ?preconisation=<id> est transmis au serveur ; changer de page le retire', async () => {
    nav.set('preconisation=p30')
    render(<PreconisationsPanel conformiteActive={false} focusId="p30" />)
    expect(await screen.findByText('Préco p30')).toBeTruthy()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/preconisations?preconisation=p30&page=1')
    fireEvent.click(screen.getByRole('button', { name: 'Précédente' }))
    expect(nav.replace).toHaveBeenLastCalledWith('/controles/questionnaires?page=1', { scroll: false })
  })

  it('une action recharge la page courante', async () => {
    nav.set('')
    render(<PreconisationsPanel conformiteActive={false} focusId={null} />)
    await screen.findByText('Préco p1')
    const avant = fetchMock.mock.calls.length
    fireEvent.click(screen.getAllByRole('button', { name: /Déclarer/i })[0])
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(true))
    await waitFor(() => expect(fetchMock.mock.calls.filter(c => !c[1]).length).toBeGreaterThan(avant))
  })
})
