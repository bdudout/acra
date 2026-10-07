import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AssocierProjet from '@/components/AssocierProjet'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/link', () => ({ default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => <a href={href} {...p}>{children}</a> }))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); refresh.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('AssocierProjet', () => {
  it('créer un nouveau projet (lié à l’analyse) ou lier un projet existant (recherche, liaison, rafraîchissement)', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => Promise.resolve({ ok: true, json: async () => (init?.method === 'POST' ? { ok: true } : { projets: [{ id: 'p1', nom: 'Migration de la paie' }, { id: 'p2', nom: 'Refonte portail' }] }) }))
    render(<AssocierProjet analyseId="a9" />)
    expect(screen.getByText('Associer un projet', { selector: 'summary' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Créer un nouveau projet' }).getAttribute('href')).toBe('/projets/nouveau?analyse=a9')
    fireEvent.click(screen.getByRole('button', { name: 'Lier un projet existant' }))
    fireEvent.change(await screen.findByLabelText('Rechercher un projet'), { target: { value: 'paie' } })
    const sel = await screen.findByLabelText('Projet à lier') as HTMLSelectElement
    expect([...sel.options].map(o => o.text)).toEqual(['—', 'Migration de la paie'])
    fireEvent.change(sel, { target: { value: 'p1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lier' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!
    expect(post[0]).toBe('/api/projets/p1/analyses')
    expect(JSON.parse(post[1].body)).toEqual({ analyseId: 'a9' })
  })
})
