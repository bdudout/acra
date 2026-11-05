// Stratégie (lot S1a) : droits par rôle et module à 3 niveaux `strategieActive` + option `strategieCadreFige`.
import { describe, expect, it } from 'vitest'
import { peutRedigerStrategie, peutValiderStrategie, peutRattacherStrategie, peutVoirStrategie, type UserRole } from '@/lib/permissions'
import { DEFAULT_ORG_CONFIG, resolveOrgConfig, BOOL_KEYS } from '@/lib/org-config'
import { GOVERNABLE_MODULES } from '@/lib/module-policy'
import { menuDuChamp } from '@/lib/fonctionnalites-menus'

type Row = Parameters<typeof resolveOrgConfig>[0][number]
const TOUS: UserRole[] = ['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN', 'SUPER_ADMIN', 'DIRECTION_METIER', 'AUDITEUR', 'CONTROLEUR', 'METIER', 'CONFORMITE', 'DPO']
const avec = (f: (r: UserRole) => boolean) => TOUS.filter(f)

describe('droits sur la stratégie', () => {
  it('rédiger : ADMIN, RSSI, RISK_MANAGER', () => {
    expect(avec(peutRedigerStrategie)).toEqual(['RISK_MANAGER', 'RSSI', 'ADMIN', 'SUPER_ADMIN'])
  })
  it('valider : ADMIN, RSSI, DIRECTION_METIER', () => {
    expect(avec(peutValiderStrategie)).toEqual(['RSSI', 'ADMIN', 'SUPER_ADMIN', 'DIRECTION_METIER'])
  })
  it('rattacher : gouvernance + CONFORMITE, CONTROLEUR, DPO', () => {
    expect(avec(peutRattacherStrategie)).toEqual(['RISK_MANAGER', 'RSSI', 'ADMIN', 'SUPER_ADMIN', 'DIRECTION_METIER', 'CONTROLEUR', 'CONFORMITE', 'DPO'])
  })
  it('AUDITEUR et LECTEUR jamais en écriture ; AUDITEUR en lecture', () => {
    for (const f of [peutRedigerStrategie, peutValiderStrategie, peutRattacherStrategie]) {
      expect(f('AUDITEUR')).toBe(false)
      expect(f('LECTEUR')).toBe(false)
    }
    expect(peutVoirStrategie('AUDITEUR')).toBe(true)
    expect(peutVoirStrategie('LECTEUR')).toBe(false)
  })
  it('tout rôle qui écrit peut lire', () => {
    for (const r of TOUS) if (peutRedigerStrategie(r) || peutValiderStrategie(r) || peutRattacherStrategie(r)) expect(peutVoirStrategie(r)).toBe(true)
  })
})

describe('module « stratégie » (3 niveaux) et option de figeage', () => {
  it('activé par défaut, désactivable par organisation, hérité', () => {
    expect(DEFAULT_ORG_CONFIG.strategieActive).toBe(true)
    expect(resolveOrgConfig([null, { strategieActive: false } as unknown as Row]).strategieActive).toBe(false)
    expect(BOOL_KEYS as readonly string[]).toContain('strategieActive')
  })
  it('gouvernable par la politique d’instance ; rangé sous « Pilotage »', () => {
    expect(GOVERNABLE_MODULES as readonly string[]).toContain('strategie')
    expect(menuDuChamp('strategieActive')).toBe('pilotage')
  })
  it('cadre figé par défaut ; réglage d’organisation (pas un module gouverné)', () => {
    expect(DEFAULT_ORG_CONFIG.strategieCadreFige).toBe(true)
    expect(resolveOrgConfig([null, { strategieCadreFige: false } as unknown as Row]).strategieCadreFige).toBe(false)
    expect(BOOL_KEYS as readonly string[]).toContain('strategieCadreFige')
    expect(GOVERNABLE_MODULES as readonly string[]).not.toContain('strategieCadreFige')
    expect(menuDuChamp('strategieCadreFige')).toBe('pilotage')
  })
})
