import { describe, it, expect } from 'vitest'
import {
  resolveModuleActivation, isModuleForced, sanitizeModulesPolicy,
} from '@/lib/module-policy'

describe('resolveModuleActivation', () => {
  it('PER_ORG / absent → la valeur de l\'organisation décide', () => {
    expect(resolveModuleActivation('PER_ORG', true)).toBe(true)
    expect(resolveModuleActivation('PER_ORG', false)).toBe(false)
    expect(resolveModuleActivation(undefined, true)).toBe(true)
    expect(resolveModuleActivation(null, false)).toBe(false)
  })
  it('FORCE_ON → actif quel que soit l\'org', () => {
    expect(resolveModuleActivation('FORCE_ON', false)).toBe(true)
    expect(resolveModuleActivation('FORCE_ON', true)).toBe(true)
  })
  it('FORCE_OFF → inactif quel que soit l\'org', () => {
    expect(resolveModuleActivation('FORCE_OFF', true)).toBe(false)
    expect(resolveModuleActivation('FORCE_OFF', false)).toBe(false)
  })
})

describe('isModuleForced', () => {
  it('vrai pour FORCE_ON / FORCE_OFF, faux sinon', () => {
    expect(isModuleForced('FORCE_ON')).toBe(true)
    expect(isModuleForced('FORCE_OFF')).toBe(true)
    expect(isModuleForced('PER_ORG')).toBe(false)
    expect(isModuleForced(undefined)).toBe(false)
  })
})

describe('sanitizeModulesPolicy', () => {
  it('ne garde que les modules connus et les états valides', () => {
    expect(sanitizeModulesPolicy({ registreRisques: 'FORCE_ON', inconnu: 'FORCE_ON', autre: 'X' }))
      .toEqual({ registreRisques: 'FORCE_ON' })
  })
  it('état invalide → ignoré', () => {
    expect(sanitizeModulesPolicy({ registreRisques: 'BIDON' })).toEqual({})
  })
  it('entrée non-objet → {}', () => {
    expect(sanitizeModulesPolicy(null)).toEqual({})
    expect(sanitizeModulesPolicy([])).toEqual({})
    expect(sanitizeModulesPolicy('x')).toEqual({})
  })
})
