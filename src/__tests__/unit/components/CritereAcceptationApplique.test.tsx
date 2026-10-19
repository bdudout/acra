/**
 * n° 51 : le critère d'acceptation appliqué en phase d'évaluation est affiché dès la phase 1
 * (lecture seule), avec qui peut le changer et, pour ces rôles, le lien vers le réglage.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CritereAcceptationApplique from '@/components/CritereAcceptationApplique'
import { resolveScaleConfig } from '@/lib/risk-scale'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const S4 = resolveScaleConfig(null)

describe('CritereAcceptationApplique', () => {
  it('appétit global : « acceptable jusqu\'au niveau 9 » et seuils par catégorie', () => {
    render(<CritereAcceptationApplique scale={S4} appetit={{ seuilGlobal: 9, parCategorie: { CYBER: 6 } }} peutModifier={false} />)
    expect(screen.getByText(/acceptable jusqu’au niveau 9/)).toBeTruthy()
    expect(screen.getByText(/1 seuil\(s\) par catégorie/)).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText(/administrateur, gestionnaire des risques ou RSSI/)).toBeTruthy()
  })
  it('sans appétit : paliers à traiter de l\'échelle de l\'organisation', () => {
    render(<CritereAcceptationApplique scale={S4} appetit={null} peutModifier={false} />)
    expect(screen.getByText(/Élevé, Critique/)).toBeTruthy()
  })
  it('rôle de gouvernance : lien vers le réglage de l\'appétit', () => {
    render(<CritereAcceptationApplique scale={S4} appetit={null} peutModifier />)
    expect(screen.getByRole('link').getAttribute('href')).toBe('/cartographie')
  })
})
