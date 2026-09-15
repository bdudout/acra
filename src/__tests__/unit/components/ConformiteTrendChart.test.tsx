import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ConformiteTrendChart, { type TrendChartPoint } from '@/components/ConformiteTrendChart'

const NOW = new Date(2026, 4, 15) // 15 mai 2026
const granLabels = { month: 'Mois', quarter: 'Trimestre', semester: 'Semestre', hint: 'Cliquer une année' }

const points: TrendChartPoint[] = [
  { id: 'a', label: null, createdAt: new Date(2024, 2, 1).toISOString(), taux: 40 },
  { id: 'b', label: null, createdAt: new Date(2025, 6, 1).toISOString(), taux: 65 },
  { id: 'c', label: 'Point courant', createdAt: new Date(2026, 4, 10).toISOString(), taux: 82 },
]

function svg() { return document.querySelector('svg') as unknown as HTMLElement }

describe('ConformiteTrendChart', () => {
  it('affiche le pourcentage à chaque point et le libellé des années', () => {
    render(<ConformiteTrendChart points={points} locale="fr" granLabels={granLabels} now={NOW} />)
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('65%')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
    // Années passées repliées (▸ = cliquable) + année en cours
    expect(within(svg()).getByText(/▸ 2024/)).toBeInTheDocument()
    expect(within(svg()).getByText(/▸ 2025/)).toBeInTheDocument()
    expect(within(svg()).getByText(/2026/)).toBeInTheDocument()
  })

  it('cliquer une année passée la déplie en mois', () => {
    render(<ConformiteTrendChart points={points} locale="fr" granLabels={granLabels} now={NOW} />)
    // Avant : 2024 replié, pas de libellé de mois court "janv"
    fireEvent.click(within(svg()).getByText(/▸ 2024/))
    // Après : 2024 déplié (▾) et des libellés de mois apparaissent
    expect(within(svg()).getByText(/▾ 2024/)).toBeInTheDocument()
    // au moins un mois court (locale fr) — janv/févr/mars…
    expect(within(svg()).queryAllByText(/janv|févr|mars|avr|mai/i).length).toBeGreaterThan(0)
  })

  it('le sélecteur de granularité bascule en trimestre', () => {
    render(<ConformiteTrendChart points={points} locale="fr" granLabels={granLabels} now={NOW} />)
    fireEvent.click(screen.getByText('Trimestre'))
    // année en cours (2026, mai) → T1, T2
    expect(within(svg()).getByText('T1')).toBeInTheDocument()
    expect(within(svg()).getByText('T2')).toBeInTheDocument()
  })

  it('un seul point → droite minimale tracée depuis 0 % (ancre non dessinée)', () => {
    const one: TrendChartPoint[] = [{ id: 'x', label: null, createdAt: new Date(2026, 3, 1).toISOString(), taux: 60 }]
    render(<ConformiteTrendChart points={one} locale="fr" granLabels={granLabels} now={NOW} />)
    // Le % réel est affiché
    expect(screen.getByText('60%')).toBeInTheDocument()
    // Une ligne de tendance existe (2 points : ancre 0 % + point réel)
    const lines = document.querySelectorAll('path[stroke]')
    expect(lines.length).toBeGreaterThan(0)
    // L'ancre 0 % n'est pas dessinée comme point (pas de « 0% » visible)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('survol d\'un point : infobulle avec %', () => {
    render(<ConformiteTrendChart points={points} locale="fr" granLabels={granLabels} now={NOW} />)
    const circles = svg().querySelectorAll('circle')
    fireEvent.mouseEnter(circles[circles.length - 1]) // dernier point (82%)
    // % présent à la fois sur l'étiquette du point et dans l'infobulle
    expect(screen.getAllByText(/82%/).length).toBeGreaterThan(1)
  })
})
