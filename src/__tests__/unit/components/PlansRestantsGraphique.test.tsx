import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PlansRestantsGraphique from '@/components/projet360/PlansRestantsGraphique'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

describe('PlansRestantsGraphique', () => {
  it('courbe prévue, ligne cible, point du jour et légende ; description accessible', () => {
    render(<PlansRestantsGraphique data={{ total: 4, fin: '2026-12-01', prevu: [{ date: '2026-09-01', restants: 4 }, { date: '2026-10-01', restants: 2 }], cible: [{ date: '2026-09-01', restants: 4 }, { date: '2026-12-01', restants: 0 }], aujourdhui: { date: '2026-10-06', restants: 3 } }} />)
    const fig = screen.getByRole('img', { name: /Plans d’action restants/ })
    expect(fig.getAttribute('aria-label')).toMatch(/Aujourd’hui : 3/)
    expect(fig.querySelectorAll('path, polyline, line, circle').length).toBeGreaterThanOrEqual(3)
    for (const l of ['Prévu (jalons)', 'Cible', 'Aujourd’hui']) expect(screen.getByText(l)).toBeTruthy()
  })
})
