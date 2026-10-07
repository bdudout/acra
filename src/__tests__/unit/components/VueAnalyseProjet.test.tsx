import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import VueAnalyseProjet from '@/components/VueAnalyseProjet'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/link', () => ({ default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => <a href={href} {...p}>{children}</a> }))

describe('VueAnalyseProjet', () => {
  it('depuis une analyse : vue analyse active, lien vers le projet', () => {
    render(<VueAnalyseProjet active="analyse" projet={{ id: 'p', nom: 'Migration paie' }} analyses={[{ id: 'a', nom: 'Cyber — paie' }]} />)
    const nav = screen.getByRole('navigation', { name: 'Vue' })
    expect(within(nav).getByText('Analyse cyber · Cyber — paie').closest('[aria-current]')?.getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: /Projet/ }).getAttribute('href')).toBe('/projets/p')
  })
  it('depuis un projet avec une analyse : lien direct ; avec plusieurs : choix de l’analyse', () => {
    const { unmount } = render(<VueAnalyseProjet active="projet" projet={{ id: 'p', nom: 'P' }} analyses={[{ id: 'a', nom: 'Cyber A' }]} />)
    expect(screen.getByRole('link', { name: 'Analyse cyber · Cyber A' }).getAttribute('href')).toBe('/analyses/a')
    unmount()
    render(<VueAnalyseProjet active="projet" projet={{ id: 'p', nom: 'P' }} analyses={[{ id: 'a', nom: 'Cyber A' }, { id: 'b', nom: 'Cyber B' }]} />)
    expect(screen.getByRole('link', { name: 'Cyber B' }).getAttribute('href')).toBe('/analyses/b')
  })
  it('sans lien analyse ⇄ projet : rien', () => {
    const { container } = render(<VueAnalyseProjet active="projet" projet={{ id: 'p', nom: 'P' }} analyses={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
