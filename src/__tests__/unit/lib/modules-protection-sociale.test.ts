import { describe, expect, it } from 'vitest'
import { DEFAULT_ORG_CONFIG, resolveOrgConfig } from '@/lib/org-config'
import { GOVERNABLE_MODULES } from '@/lib/module-policy'
import { buildNav, type NavKey, type NavModules } from '@/lib/navigation'

const OFF: NavModules = { registre: false, incidents: false, controles: false, audit: false, kri: false, reglementaire: false, profilsOperationnels: false }
const keys = (role: Parameters<typeof buildNav>[0], m: NavModules): NavKey[] => buildNav(role, m).entries.flatMap(e => (e.kind === 'link' ? [e.key] : e.items))

describe('modules homologations, recertification, registre IA — activation à 3 niveaux', () => {
  it('désactivés par défaut, activables par organisation, héritables', () => {
    expect(DEFAULT_ORG_CONFIG.homologationsActive).toBe(false)
    expect(DEFAULT_ORG_CONFIG.recertificationActive).toBe(false)
    expect(DEFAULT_ORG_CONFIG.registreIaActive).toBe(false)
    const child = resolveOrgConfig([null, { homologationsActive: true, registreIaActive: true } as unknown as Parameters<typeof resolveOrgConfig>[0][number]])
    expect(child.homologationsActive).toBe(true); expect(child.registreIaActive).toBe(true); expect(child.recertificationActive).toBe(false)
  })
  it('gouvernables par la politique d’instance', () => {
    for (const m of ['homologations', 'recertification', 'registreIa']) expect(GOVERNABLE_MODULES as readonly string[]).toContain(m)
  })
  it('navigation : visibles seulement si le module est actif, selon le rôle', () => {
    expect(keys('RSSI', OFF)).not.toContain('homologations')
    const on: NavModules = { ...OFF, homologations: true, recertification: true, registreIa: true }
    expect(keys('RSSI', on)).toEqual(expect.arrayContaining(['homologations', 'registreIa']))
    expect(keys('DIRECTION_METIER', on)).toContain('homologations') // autorité d'homologation
    // Revues d'habilitations masquées tant que le module n'a pas d'écran (lot P5 non livré).
    expect(keys('RSSI', on)).not.toContain('recertification')
    expect(keys('METIER', on)).not.toContain('recertification')
    expect(keys('METIER', on)).not.toContain('registreIa')
    expect(keys('LECTEUR', on)).not.toContain('recertification')
  })
})
