import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseNavModules,
  peekNavModules,
  loadNavModules,
  setCachedNavModules,
  __resetNavModulesCacheForTest,
} from '@/lib/nav-modules-cache'

beforeEach(() => __resetNavModulesCacheForTest())

describe('parseNavModules', () => {
  it('coerce les clés connues en booléens', () => {
    expect(parseNavModules({ registre: true, incidents: 1, audit: 'x' })).toEqual({
      registre: true, incidents: true, controles: false, audit: true, kri: false, reglementaire: false,
    })
  })
  it('renvoie null si aucune clé booléenne connue', () => {
    expect(parseNavModules({})).toBeNull()
    expect(parseNavModules(null)).toBeNull()
    expect(parseNavModules('nope')).toBeNull()
    expect(parseNavModules({ registre: 'true' })).toBeNull() // pas un booléen
  })
})

describe('cache en mémoire', () => {
  it('peek renvoie null tant que rien n’est mémorisé (sûr pour SSR/1er rendu)', () => {
    expect(peekNavModules()).toBeNull()
  })
  it('après setCachedNavModules, peek renvoie la valeur mémorisée', () => {
    const m = { registre: true, incidents: false, controles: true, audit: false, kri: false, reglementaire: false }
    setCachedNavModules(m)
    expect(peekNavModules()).toEqual(m)
    expect(loadNavModules()).toEqual(m)
  })
  it('__resetNavModulesCacheForTest vide le cache mémoire', () => {
    setCachedNavModules({ registre: true, incidents: false, controles: false, audit: false, kri: false, reglementaire: false })
    __resetNavModulesCacheForTest()
    expect(peekNavModules()).toBeNull()
  })
})
