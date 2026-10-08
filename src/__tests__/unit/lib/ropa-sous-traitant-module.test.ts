// Registre du sous-traitant (RGPD art. 30 §2) : module activable en option (modèle de configuration à 3 niveaux).
import { describe, expect, it } from 'vitest'
import { DEFAULT_ORG_CONFIG, resolveOrgConfig, BOOL_KEYS } from '@/lib/org-config'
import { GOVERNABLE_MODULES, resolveModuleActivation } from '@/lib/module-policy'
import { menuDuChamp } from '@/lib/fonctionnalites-menus'

type Row = Parameters<typeof resolveOrgConfig>[0][number]

describe('module « registre du sous-traitant »', () => {
  it('désactivé par défaut, activable par organisation et hérité dans l’arbre', () => {
    expect(DEFAULT_ORG_CONFIG.ropaSousTraitantActive).toBe(false)
    expect(resolveOrgConfig([null, { ropaSousTraitantActive: true } as unknown as Row]).ropaSousTraitantActive).toBe(true)
    expect(BOOL_KEYS as readonly string[]).toContain('ropaSousTraitantActive')
  })
  it('gouvernable par la politique d’instance ; rangé sous le menu « Registres »', () => {
    expect(GOVERNABLE_MODULES as readonly string[]).toContain('ropaSousTraitant')
    expect(resolveModuleActivation('FORCE_OFF', true)).toBe(false)
    expect(menuDuChamp('ropaSousTraitantActive')).toBe('registre')
  })
})
