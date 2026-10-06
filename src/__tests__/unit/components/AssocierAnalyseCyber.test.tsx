import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AssocierAnalyseCyber from '@/components/projet360/AssocierAnalyseCyber'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/link', () => ({ default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => <a href={href} {...p}>{children}</a> }))
const fetchMock = vi.fn()
const ok = (b: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => b } as Response)
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('AssocierAnalyseCyber', () => {
  it('menu : créer une nouvelle analyse (lien) ou lier une analyse existante (recherche, puis liaison)', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => init?.method === 'POST' ? ok({ ok: true, analyse: { id: 'a1', nom: 'Cyber — paie' } }) : ok({ sources: [{ id: 'a1', nom: 'Cyber — paie', methode: 'EBIOS_RM' }] }))
    const onLinked = vi.fn()
    render(<AssocierAnalyseCyber projetId="p1" canCreate onLinked={onLinked} />)
    expect(screen.getByText('Associer une analyse cyber', { selector: 'summary' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Créer une nouvelle analyse' }).getAttribute('href')).toBe('/analyses/new?projet=p1')
    fireEvent.click(screen.getByRole('button', { name: 'Lier une analyse existante' }))
    fireEvent.change(await screen.findByLabelText('Rechercher une analyse cyber'), { target: { value: 'paie' } })
    fireEvent.change(await screen.findByLabelText('Analyse à lier'), { target: { value: 'a1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lier' }))
    await waitFor(() => expect(onLinked).toHaveBeenCalledWith({ id: 'a1', nom: 'Cyber — paie' }))
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!
    expect(post[0]).toBe('/api/projets/p1/analyses')
    expect(JSON.parse(post[1].body)).toEqual({ analyseId: 'a1' })
  })
  it('sans droit de création : seule la liaison est proposée', () => {
    render(<AssocierAnalyseCyber projetId="p1" canCreate={false} />)
    expect(screen.queryByRole('link', { name: 'Créer une nouvelle analyse' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Lier une analyse existante' })).toBeTruthy()
  })
})
