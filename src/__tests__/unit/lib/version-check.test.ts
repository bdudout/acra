import { describe, it, expect } from 'vitest'
import { parseSemver, compareSemver, updateAvailable, canDispatchReleaseDeployment } from '@/lib/version-check'

describe('parseSemver', () => {
  it('accepte le préfixe v et ignore le pré-release', () => {
    expect(parseSemver('v1.2.3')).toEqual([1, 2, 3])
    expect(parseSemver('1.0.0-rc.1')).toEqual([1, 0, 0])
    expect(parseSemver('2.5')).toEqual([2, 5, 0])
  })
  it('valeur invalide → null', () => {
    expect(parseSemver('abc')).toBeNull()
    expect(parseSemver('')).toBeNull()
    expect(parseSemver(null)).toBeNull()
  })
})

describe('compareSemver', () => {
  it('ordonne correctement', () => {
    expect(compareSemver('1.0.0', '1.0.1')).toBe(-1)
    expect(compareSemver('1.2.0', '1.1.9')).toBe(1)
    expect(compareSemver('v2.0.0', '2.0.0')).toBe(0)
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1) // numérique, pas lexicographique
  })
})

describe('updateAvailable', () => {
  it('vrai seulement si latest > current', () => {
    expect(updateAvailable('1.0.0', '1.1.0')).toBe(true)
    expect(updateAvailable('1.1.0', '1.1.0')).toBe(false)
    expect(updateAvailable('1.2.0', '1.1.0')).toBe(false)
  })
  it('versions invalides → false (pas de fausse alerte)', () => {
    expect(updateAvailable('1.0.0', 'nightly')).toBe(false)
    expect(updateAvailable(null, '1.0.0')).toBe(false)
  })
})

describe('canDispatchReleaseDeployment', () => {
  it('n’accepte que la dernière release strictement plus récente', () => {
    expect(canDispatchReleaseDeployment('1.0.0', 'v1.0.2', 'v1.0.2')).toBe(true)
    expect(canDispatchReleaseDeployment('1.0.0', 'v4.5.3', '4.5.3')).toBe(true)
    expect(canDispatchReleaseDeployment('1.0.0', 'v1.0.2', 'v1.0.1')).toBe(false)
    expect(canDispatchReleaseDeployment('1.0.2', 'v1.0.2', 'v1.0.2')).toBe(false)
  })
})

// ─── #185 : canaux stable / bêta et préversions ────────────────────────────
import { compareVersions, describeVersion, isUpdateChannel } from '@/lib/version-check'

describe('compareVersions (préversions SemVer)', () => {
  it('une préversion précède la version finale ; identifiants numériques comparés numériquement', () => {
    expect(compareVersions('1.0.4-beta.1', '1.0.4')).toBe(-1)
    expect(compareVersions('1.0.4', '1.0.4-beta.9')).toBe(1)
    expect(compareVersions('1.0.4-beta.2', '1.0.4-beta.10')).toBe(-1)
    expect(compareVersions('1.0.4-beta.1', '1.0.3')).toBe(1)
    expect(compareVersions('v1.0.3', '1.0.3')).toBe(0)
  })
})

describe('updateAvailable — préversions', () => {
  it('une bêta 1.0.4 est en retard sur la stable 1.0.4, pas sur la 1.0.3', () => {
    expect(updateAvailable('1.0.4-beta.1', 'v1.0.4')).toBe(true)
    expect(updateAvailable('1.0.4-beta.1', 'v1.0.3')).toBe(false)
  })
  it('régression #185 : instance à jour (1.0.3) face à la dernière stable v1.0.3 → rien à faire', () => {
    expect(updateAvailable('1.0.3', 'v1.0.3')).toBe(false)
  })
})

describe('describeVersion', () => {
  it('stable à jour', () => {
    expect(describeVersion('1.0.3', 'v1.0.3')).toEqual({ channel: 'stable', updateAvailable: false, base: null })
  })
  it('bêta basée sur la dernière version validée', () => {
    expect(describeVersion('1.0.4-beta.2', 'v1.0.3')).toEqual({ channel: 'beta', updateAvailable: false, base: 'v1.0.3' })
  })
  it('bêta rattrapée par une stable → mise à jour disponible', () => {
    expect(describeVersion('1.0.4-beta.2', 'v1.0.4')).toEqual({ channel: 'beta', updateAvailable: true, base: null })
  })
  it('dernière stable inconnue (GitHub injoignable) : pas de fausse alerte', () => {
    expect(describeVersion('1.0.3', null)).toEqual({ channel: 'stable', updateAvailable: false, base: null })
  })
})

describe('isUpdateChannel', () => {
  it('seuls stable et beta sont acceptés', () => {
    expect(isUpdateChannel('stable')).toBe(true)
    expect(isUpdateChannel('beta')).toBe(true)
    expect(isUpdateChannel('main; rm -rf /')).toBe(false)
    expect(isUpdateChannel(undefined)).toBe(false)
  })
})
