// Recette n° 62 (suite) : la vue d'ensemble du tableau de bord affichait 80 % et « Atelier 5/5 »
// pour une analyse APPROUVÉE ; une analyse approuvée est finalisée comme une terminée.
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AnalysesChart from '@/components/AnalysesChart'
import { fr } from '@/lib/i18n/fr'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const analyse = (statut: string) => ({
  id: statut, nom: `Analyse ${statut}`, statut, atelierCourant: 5, updatedAt: '2026-10-02',
  risques: [], mesures: [], _count: { sourcesRisque: 0, scenariosStrategiques: 0, risques: 0, mesures: 0 },
})

describe('AnalysesChart — statut finalisé (n° 62)', () => {
  it('analyse approuvée : 100 % et libellé « Approuvée »', () => {
    render(<AnalysesChart analyses={[analyse('APPROUVE')]} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText(fr.statusLabels.APPROUVE)).toBeInTheDocument()
  })
  it('analyse en cours à l’atelier 5 : 80 %', () => {
    render(<AnalysesChart analyses={[analyse('EN_COURS')]} />)
    expect(screen.getByText('80%')).toBeInTheDocument()
  })
})
