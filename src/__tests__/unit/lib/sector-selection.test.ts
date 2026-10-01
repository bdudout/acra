import { describe, expect, it } from 'vitest'
import { moveSector, toggleSector, MAX_SECTORS } from '@/lib/sector-selection'

describe('sélection des secteurs d’une organisation (le 1er = secteur principal)', () => {
  it('ajoute en fin, retire, et plafonne à trois secteurs', () => {
    expect(MAX_SECTORS).toBe(3)
    expect(toggleSector([], 'SANTE')).toEqual(['SANTE'])
    expect(toggleSector(['SANTE'], 'SAAS')).toEqual(['SANTE', 'SAAS'])
    expect(toggleSector(['SANTE', 'SAAS'], 'SANTE')).toEqual(['SAAS'])
    expect(toggleSector(['SANTE', 'SAAS', 'PUBLIC'], 'FINANCE')).toEqual(['SANTE', 'SAAS', 'PUBLIC']) // plafond : inchangé
    expect(toggleSector(['SANTE'], 'INCONNU')).toEqual(['SANTE']) // code inconnu ignoré
  })
  it('monte / descend un secteur, sans sortir des bornes', () => {
    expect(moveSector(['SANTE', 'SAAS', 'PUBLIC'], 'PUBLIC', 'up')).toEqual(['SANTE', 'PUBLIC', 'SAAS'])
    expect(moveSector(['SANTE', 'SAAS'], 'SANTE', 'up')).toEqual(['SANTE', 'SAAS'])
    expect(moveSector(['SANTE', 'SAAS'], 'SAAS', 'down')).toEqual(['SANTE', 'SAAS'])
    expect(moveSector(['SANTE', 'SAAS'], 'INCONNU', 'up')).toEqual(['SANTE', 'SAAS'])
  })
})
