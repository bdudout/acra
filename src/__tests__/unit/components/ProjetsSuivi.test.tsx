import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ProjetsSuivi from '@/components/ProjetsSuivi'

vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const synthese = {
  total: 2, enCours: 2, termines: 0, enRetard: 1, valides: 1,
  projets: [
    { id: 'p1', nom: 'Refonte portail', statut: 'EN_COURS', risques: 5, eleves: 2, validation: 'PARTIELLE' as const, enRetard: true, dateEcheance: '2026-09-01T00:00:00.000Z' },
    { id: 'p2', nom: 'Migration cloud', statut: 'APPROUVE', risques: 3, eleves: 0, validation: 'COMPLETE' as const, enRetard: false, dateEcheance: null },
  ],
}

describe('ProjetsSuivi (cockpit GRC)', () => {
  it('affiche les compteurs, les projets à surveiller en tête et le lien vers le projet', () => {
    render(<ProjetsSuivi synthese={synthese} />)
    expect(screen.getByRole('heading', { name: 'Suivi des projets 360' })).toBeTruthy()
    const lignes = screen.getAllByRole('row').slice(1)
    expect(within(lignes[0]).getByRole('link', { name: 'Refonte portail' }).getAttribute('href')).toBe('/analyses/p1/atelier/1?phase=qualification')
    expect(within(lignes[0]).getByText('Partielle')).toBeTruthy()
    expect(within(lignes[0]).getByText('En retard')).toBeTruthy()
    expect(within(lignes[1]).getByText('Complète')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ouvrir l’onglet Projets' }).getAttribute('href')).toBe('/projets')
  })
  it('message vide quand aucun projet', () => {
    render(<ProjetsSuivi synthese={{ total: 0, enCours: 0, termines: 0, enRetard: 0, valides: 0, projets: [] }} />)
    expect(screen.getByText('Aucun projet 360 pour le moment.')).toBeTruthy()
  })
})
