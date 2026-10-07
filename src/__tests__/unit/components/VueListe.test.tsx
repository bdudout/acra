import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
vi.mock('next/link', () => ({ default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => <a href={href} {...p}>{children}</a> }))
import AnalysesClient from '@/components/AnalysesClient'
import ProjetsManager from '@/components/ProjetsManager'

const analyse = (id: string, nom: string) => ({
  id, nom, statut: 'EN_COURS', organisation: 'Org', secteur: 'Santé', atelierCourant: 2, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
  tags: [], methode: 'EBIOS_RM', _count: { sourcesRisque: 1, scenariosStrategiques: 2, risques: 3 }, riskSummary: { maxRisk: 9, critiques: 0 },
})
beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) }))) })

describe('Bascule vue détaillée / liste simple', () => {
  it('analyses : cartes par défaut ; « Liste simple » affiche un tableau compact, mémorisé', () => {
    const { unmount } = render(<AnalysesClient initialAnalyses={[analyse('a1', 'Cyber — paie'), analyse('a2', 'Cyber — portail')]} />)
    const vue = screen.getByRole('group', { name: 'Présentation de la liste' })
    expect(within(vue).getByRole('button', { name: 'Vue détaillée' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('table')).toBeNull()
    fireEvent.click(within(vue).getByRole('button', { name: 'Liste simple' }))
    const lignes = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(lignes).toHaveLength(2)
    expect(within(lignes[0]).getByRole('link', { name: 'Cyber — paie' }).getAttribute('href')).toBe('/analyses/a1')
    unmount()
    render(<AnalysesClient initialAnalyses={[analyse('a1', 'Cyber — paie')]} />)
    expect(screen.getByRole('table')).toBeTruthy()
  })
  it('projets : liste simple par défaut ; « Vue détaillée » affiche des cartes (météo, mise en service, analyses)', () => {
    render(<ProjetsManager canCreate projets={[{ id: 'p1', nom: 'Refonte portail', statut: 'EN_COURS', risques: 7, updatedAt: '2026-09-20T00:00:00.000Z', meteo: 'ORAGE', miseEnService: '2026-12-01', analyses: [{ id: 'c1', nom: 'Cyber — portail' }] }]} />)
    expect(screen.getByRole('table')).toBeTruthy()
    fireEvent.click(within(screen.getByRole('group', { name: 'Présentation de la liste' })).getByRole('button', { name: 'Vue détaillée' }))
    expect(screen.queryByRole('table')).toBeNull()
    const carte = screen.getByRole('article', { name: 'Refonte portail' })
    expect(within(carte).getByText('Orage — projet en danger')).toBeTruthy()
    expect(within(carte).getByText(/01\/12\/2026/)).toBeTruthy()
    expect(within(carte).getByRole('link', { name: 'Cyber — portail' })).toBeTruthy()
  })
})
