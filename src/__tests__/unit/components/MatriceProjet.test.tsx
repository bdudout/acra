import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MatriceProjet from '@/components/projet360/MatriceProjet'
import { resolveScaleConfig } from '@/lib/risk-scale'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const risques = [
  { id: 'a', nom: 'Fuite de données', domaine: 'CYBER', brut: { g: 4, v: 4 }, actuel: { g: 4, v: 2 }, residuel: { g: 2, v: 2 } },
  { id: 'b', nom: 'Dérive du planning', domaine: 'PROJECT', brut: { g: 3, v: 3 }, actuel: { g: 3, v: 3 }, residuel: { g: 3, v: 3 } },
]
import { fr } from '@/lib/i18n/fr'
const trL = (l: string) => (fr.scaleDefaults as Record<string, string>)[l] ?? l
const cellule = (g: string, v: string) => [...document.querySelectorAll('td[aria-label]')].find(c => c.getAttribute('aria-label')!.startsWith(`Vraisemblance ${trL(v)}, Gravité ${trL(g)}`))!

describe('MatriceProjet', () => {
  it('bascule brut / actuel / résiduel et filtre par catégorie (sous la matrice)', () => {
    render(<MatriceProjet risques={risques} scale={resolveScaleConfig(null)} />)
    const g = resolveScaleConfig(null)
    const lab = (n: number, k: 'echelleGravite' | 'echelleVraisemblance') => g[k].find(x => x.niveau === n)!.label
    // Brut par défaut : « Fuite » en G4 × V4.
    expect(cellule(lab(4, 'echelleGravite'), lab(4, 'echelleVraisemblance')).getAttribute('aria-label')).toMatch(/1 risque/)
    fireEvent.click(screen.getByRole('tab', { name: 'Résiduel' }))
    expect(cellule(lab(4, 'echelleGravite'), lab(4, 'echelleVraisemblance')).getAttribute('aria-label')).toMatch(/aucun risque/)
    expect(cellule(lab(2, 'echelleGravite'), lab(2, 'echelleVraisemblance')).getAttribute('aria-label')).toMatch(/1 risque/)
    // Filtre par catégorie : « Projet » ne garde que la dérive du planning.
    const filtre = screen.getByRole('group', { name: 'Filtrer par catégorie' })
    expect(within(filtre).getByRole('button', { name: /Toutes \(2\)/ })).toBeTruthy()
    fireEvent.click(within(filtre).getByRole('button', { name: /Projet \(1\)/ }))
    expect(cellule(lab(2, 'echelleGravite'), lab(2, 'echelleVraisemblance')).getAttribute('aria-label')).toMatch(/aucun risque/)
    expect(cellule(lab(3, 'echelleGravite'), lab(3, 'echelleVraisemblance')).getAttribute('aria-label')).toMatch(/1 risque/)
  })
})
