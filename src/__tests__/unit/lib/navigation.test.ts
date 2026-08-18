/**
 * navigation.test.ts — modèle de navigation (fonction pure).
 *
 * `buildNav` sépare les liens en deux groupes :
 *  - `primary` : le parcours EBIOS de tous les jours (toujours 5 liens, inline) ;
 *  - `grc`     : gouvernance + modules GRC (repliés dans un menu déroulant « GRC »).
 *
 * La règle d'or : le GATING (qui voit quoi) doit rester STRICTEMENT identique à
 * l'ancienne barre — on ne change que la disposition, jamais les droits.
 */
import { describe, it, expect } from 'vitest'
import { buildNav, type NavModules } from '@/lib/navigation'

const ALL_ON: NavModules = {
  registre: true, incidents: true, controles: true, audit: true, kri: true, reglementaire: true,
}
const ALL_OFF: NavModules = {
  registre: false, incidents: false, controles: false, audit: false, kri: false, reglementaire: false,
}

describe('buildNav — groupe primaire', () => {
  it('expose toujours les 5 liens EBIOS de base, quel que soit le rôle', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'RSSI', 'DIRECTION_METIER', 'AUDITEUR', 'ANALYSTE', 'LECTEUR', 'CONTROLEUR', 'METIER'] as const) {
      expect(buildNav(role, ALL_OFF).primary).toEqual(['dashboard', 'analyses', 'risques', 'tiers', 'actions'])
    }
  })
})

describe('buildNav — groupe GRC (gating préservé)', () => {
  it('LECTEUR ne voit que les incidents (déclaration ouverte à tous), rien d’autre', () => {
    const { grc } = buildNav('LECTEUR', ALL_ON)
    expect(grc).toEqual(['incidents'])
  })

  it('LECTEUR sans module incidents n’a aucun item GRC', () => {
    expect(buildNav('LECTEUR', ALL_OFF).grc).toEqual([])
  })

  it('ANALYSTE : registre + modules, mais ni conformité, ni dérogations, ni pilotage/processus', () => {
    const { grc } = buildNav('ANALYSTE', ALL_ON)
    expect(grc).toEqual([
      'registre', 'campagnes', 'cartographie',
      'incidents', 'controles', 'audit', 'kri', 'reglementaire',
    ])
    expect(grc).not.toContain('conformite')
    expect(grc).not.toContain('derogations')
    expect(grc).not.toContain('pilotage')
  })

  it('RISK_MANAGER avec tous les modules : gouvernance + registre + pilotage + modules', () => {
    const { grc } = buildNav('RISK_MANAGER', ALL_ON)
    expect(grc).toEqual([
      'conformite', 'derogations',
      'registre', 'campagnes', 'cartographie', 'pilotage', 'processus',
      'incidents', 'controles', 'audit', 'kri', 'reglementaire',
    ])
  })

  it('ADMIN sans aucun module : uniquement conformité + dérogations', () => {
    expect(buildNav('ADMIN', ALL_OFF).grc).toEqual(['conformite', 'derogations'])
  })

  it('DIRECTION_METIER : dérogations + pilotage/processus (registre actif), pas de conformité', () => {
    const { grc } = buildNav('DIRECTION_METIER', ALL_ON)
    expect(grc).toContain('derogations')
    expect(grc).toContain('pilotage')
    expect(grc).toContain('processus')
    expect(grc).not.toContain('conformite')
  })

  it('METIER (1ʳᵉ ligne) ne voit que les incidents, comme LECTEUR', () => {
    expect(buildNav('METIER', ALL_ON).grc).toEqual(['incidents'])
    expect(buildNav('METIER', ALL_OFF).grc).toEqual([])
  })

  it('CONTROLEUR (2ᵉ ligne) voit les modules mais pas la gouvernance', () => {
    const { grc } = buildNav('CONTROLEUR', ALL_ON)
    expect(grc).toContain('controles')
    expect(grc).toContain('audit')
    expect(grc).toContain('registre')
    expect(grc).not.toContain('conformite')
    expect(grc).not.toContain('derogations')
    expect(grc).not.toContain('pilotage')
  })

  it('pilotage/processus exigent le module registre ET un rôle gouvernance/métier', () => {
    // registre off → jamais de pilotage même pour un RSSI
    expect(buildNav('RSSI', ALL_OFF).grc).not.toContain('pilotage')
    // registre on mais ANALYSTE → pas de pilotage
    expect(buildNav('ANALYSTE', ALL_ON).grc).not.toContain('pilotage')
  })
})
