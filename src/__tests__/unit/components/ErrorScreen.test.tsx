import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ErrorScreen from '@/components/ErrorScreen'

describe('ErrorScreen', () => {
  it('affiche une page 404 ACRA avec le logo et un retour sûr', () => {
    render(<ErrorScreen kind="notFound" onRetry={vi.fn()} />)
    expect(screen.getByRole('img', { name: 'ACRA' })).toHaveAttribute('src', '/logo-mark.png')
    expect(screen.getByText('404')).toBeInTheDocument()
    const home = screen.getByRole('link')
    expect(home).toHaveAttribute('href', '/')
    expect(home).toHaveClass('bg-white!', 'text-slate-950!')
  })

  it('propose de réessayer après une erreur applicative', () => {
    const retry = vi.fn()
    render(<ErrorScreen kind="error" onRetry={retry} />)
    fireEvent.click(screen.getByRole('button'))
    expect(retry).toHaveBeenCalledOnce()
  })
})

describe('ErrorScreen — signaler l’erreur sur GitHub', () => {
  it('erreur applicative : lien vers une issue pré-remplie (version installée, page anonymisée), aperçu lisible ; rien n’est envoyé', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ version: 'v1.0.5', revision: 'abc1234', issuesRepo: 'bdudout/acra' }) }))
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'acra-locale=fr'
    window.history.pushState({}, '', '/analyses/cmuz72j4n0004c5te5ep9644d/atelier/2?secret=1')
    render(<ErrorScreen kind="error" onRetry={vi.fn()} digest="3301562041" />)
    const lien = await screen.findByRole('link', { name: 'Signaler le problème sur GitHub' })
    const url = new URL(lien.getAttribute('href')!)
    expect(url.origin + url.pathname).toBe('https://github.com/bdudout/acra/issues/new')
    expect(url.searchParams.get('title')).toBe('[Erreur 500] /analyses/:id/atelier/2')
    expect(url.searchParams.get('body')).toContain('| Version | v1.0.5 |')
    expect(url.searchParams.get('body')).toContain('| Référence | 3301562041 |')
    expect(url.searchParams.get('body')).not.toContain('secret')
    expect(lien).toHaveAttribute('target', '_blank')
    expect(lien).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByText('Voir ce qui sera transmis')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything())
    vi.unstubAllGlobals()
  })
  it('page introuvable : pas de signalement proposé', () => {
    render(<ErrorScreen kind="notFound" />)
    expect(screen.queryByText('Signaler le problème sur GitHub')).toBeNull()
  })
})
