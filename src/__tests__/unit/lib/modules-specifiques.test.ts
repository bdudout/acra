// Fonctions spécifiques activables séparément (3 niveaux) : campagnes RCSA, appétence au risque (RAS / RAD), rapports
// GRC. Désactivées par défaut (une organisation qui s'en servait déjà est reprise active par la migration).
import { describe, expect, it } from 'vitest'
import { DEFAULT_ORG_CONFIG, resolveOrgConfig, campagnesRcsaActives, appetenceDisponible } from '@/lib/org-config'
import { GOVERNABLE_MODULES } from '@/lib/module-policy'
import { buildNav, type NavKey, type NavModules } from '@/lib/navigation'
import { rapportsDisponibles } from '@/lib/rapport-model'

type Row = Parameters<typeof resolveOrgConfig>[0][number]
const BASE: NavModules = { registre: true, incidents: true, controles: true, audit: true, kri: true, reglementaire: true, profilsOperationnels: true }
const keys = (role: Parameters<typeof buildNav>[0], m: NavModules): NavKey[] => buildNav(role, m).entries.flatMap(e => (e.kind === 'link' ? [e.key] : e.items))

describe('campagnes RCSA, appétence (RAS / RAD), rapports GRC — activation séparée', () => {
  it('désactivées par défaut, activables par organisation et héritées dans l’arbre', () => {
    expect(DEFAULT_ORG_CONFIG.campagnesRcsaActive).toBe(false)
    expect(DEFAULT_ORG_CONFIG.appetenceActive).toBe(false)
    expect(DEFAULT_ORG_CONFIG.rapportsGrcActive).toBe(false)
    const fille = resolveOrgConfig([null, { campagnesRcsaActive: true, appetenceActive: true } as unknown as Row])
    expect(fille.campagnesRcsaActive).toBe(true); expect(fille.appetenceActive).toBe(true); expect(fille.rapportsGrcActive).toBe(false)
  })

  it('gouvernables par la politique d’instance (imposé / interdit)', () => {
    for (const m of ['campagnesRcsa', 'appetence', 'rapportsGrc']) expect(GOVERNABLE_MODULES as readonly string[]).toContain(m)
  })

  it('campagnes RCSA : registre des risques ET interrupteur actifs', () => {
    expect(campagnesRcsaActives({ registreRisquesActive: true, campagnesRcsaActive: true })).toBe(true)
    expect(campagnesRcsaActives({ registreRisquesActive: true, campagnesRcsaActive: false })).toBe(false)
    expect(campagnesRcsaActives({ registreRisquesActive: false, campagnesRcsaActive: true })).toBe(false)
  })

  it('appétence : interrupteur actif ET au moins une source (registre, KRI ou maturité)', () => {
    expect(appetenceDisponible({ actif: true, registre: false, kri: true, maturite: false })).toBe(true)
    expect(appetenceDisponible({ actif: false, registre: true, kri: true, maturite: true })).toBe(false)
    expect(appetenceDisponible({ actif: true, registre: false, kri: false, maturite: false })).toBe(false)
  })

  it('rapports GRC : aucun rapport proposé si l’interrupteur est coupé, même avec les modules sources actifs', () => {
    const sources = { registreRisquesActive: true, incidentsActive: true, controlePermanentActive: true, auditInterneActive: true }
    expect(rapportsDisponibles({ ...sources, rapportsGrcActive: false })).toEqual([])
    expect(rapportsDisponibles({ ...sources, rapportsGrcActive: true }).length).toBeGreaterThan(0)
  })

  it('navigation : chaque entrée n’apparaît que si son interrupteur est actif', () => {
    const off = keys('RSSI', BASE)
    expect(off).not.toContain('campagnes'); expect(off).not.toContain('appetence'); expect(off).not.toContain('rapports')
    expect(off).toEqual(expect.arrayContaining(['registre', 'processus', 'kri', 'incidents']))
    const on = keys('RSSI', { ...BASE, campagnesRcsa: true, appetence: true, rapportsGrc: true })
    expect(on).toEqual(expect.arrayContaining(['campagnes', 'appetence', 'rapports']))
    // L'interrupteur seul ne suffit pas : il faut aussi le module de base.
    expect(keys('RSSI', { ...BASE, registre: false, campagnesRcsa: true })).not.toContain('campagnes')
  })
})
