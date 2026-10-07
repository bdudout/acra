// Les activations (fonctionnalités de l'organisation, politique d'instance) sont présentées selon les menus de la barre
// de navigation, dans le même ordre, pour qu'un administrateur retrouve chaque module là où il apparaît.
import { describe, expect, it } from 'vitest'
import { MENUS_FONCTIONNALITES, menuDuChamp, menuDuModule, grouperParMenu } from '@/lib/fonctionnalites-menus'
import { GOVERNABLE_MODULES } from '@/lib/module-policy'

describe('regroupement des activations par menu de navigation', () => {
  it('ordre de la barre de navigation, puis les réglages transverses', () => {
    expect(MENUS_FONCTIONNALITES).toEqual(['pilotage', 'analyses', 'registre', 'controleAudit', 'conformite', 'reglementaire', 'general'])
  })
  it('chaque module se range dans le menu où il apparaît', () => {
    expect(menuDuChamp('appetenceActive')).toBe('pilotage')
    expect(menuDuChamp('kriActive')).toBe('pilotage')
    expect(menuDuChamp('projets360Active')).toBe('analyses')
    expect(menuDuChamp('qualificationActive')).toBe('analyses')
    expect(menuDuChamp('campagnesRcsaActive')).toBe('registre')
    expect(menuDuChamp('incidentsActive')).toBe('registre')
    expect(menuDuChamp('registreIaActive')).toBe('registre')
    expect(menuDuChamp('auditInterneActive')).toBe('controleAudit')
    expect(menuDuChamp('profilsOperationnelsActive')).toBe('conformite')
    expect(menuDuChamp('rapportsGrcActive')).toBe('reglementaire')
    expect(menuDuChamp('mcpActive')).toBe('general')
    expect(menuDuChamp('inconnu')).toBe('general')
  })
  it('tout module de la politique d’instance a un menu explicite', () => {
    for (const m of GOVERNABLE_MODULES) expect(MENUS_FONCTIONNALITES).toContain(menuDuModule(m))
    expect(menuDuModule('registreRisques')).toBe('registre')
    expect(menuDuModule('appetence')).toBe('pilotage')
  })
  it('groupes dans l’ordre des menus, ordre interne conservé, groupes vides omis', () => {
    const items = [{ f: 'mcpActive' }, { f: 'registreRisquesActive' }, { f: 'kriActive' }, { f: 'campagnesRcsaActive' }]
    expect(grouperParMenu(items, i => menuDuChamp(i.f))).toEqual([
      { menu: 'pilotage', items: [{ f: 'kriActive' }] },
      { menu: 'registre', items: [{ f: 'registreRisquesActive' }, { f: 'campagnesRcsaActive' }] },
      { menu: 'general', items: [{ f: 'mcpActive' }] },
    ])
  })
})
