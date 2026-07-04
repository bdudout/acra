import { describe, it, expect } from 'vitest'
import {
  CONFORMITE_NIVEAUX,
  CONFORMITE_SNAPSHOT_MODES,
  sanitizeConformiteNiveau,
  sanitizeSnapshotMode,
  isOrgLevelConformite,
  shouldSnapshotOnChange,
  dueForAutoSnapshot,
} from '../../../lib/conformite-config'

describe('conformite-config — options Palier 2', () => {
  it('niveaux et modes attendus', () => {
    expect(CONFORMITE_NIVEAUX).toEqual(['ANALYSE', 'ORGANISATION'])
    expect(CONFORMITE_SNAPSHOT_MODES).toEqual(['MANUEL', 'AUTO', 'CHANGEMENT'])
  })

  it('sanitizeConformiteNiveau : valeur valide gardée, sinon défaut ANALYSE', () => {
    expect(sanitizeConformiteNiveau('ORGANISATION')).toBe('ORGANISATION')
    expect(sanitizeConformiteNiveau('ANALYSE')).toBe('ANALYSE')
    expect(sanitizeConformiteNiveau('bidon')).toBe('ANALYSE')
    expect(sanitizeConformiteNiveau(undefined)).toBe('ANALYSE')
    expect(sanitizeConformiteNiveau(null)).toBe('ANALYSE')
  })

  it('sanitizeSnapshotMode : valeur valide gardée, sinon défaut MANUEL', () => {
    expect(sanitizeSnapshotMode('AUTO')).toBe('AUTO')
    expect(sanitizeSnapshotMode('CHANGEMENT')).toBe('CHANGEMENT')
    expect(sanitizeSnapshotMode('MANUEL')).toBe('MANUEL')
    expect(sanitizeSnapshotMode('x')).toBe('MANUEL')
    expect(sanitizeSnapshotMode(42)).toBe('MANUEL')
  })

  it('isOrgLevelConformite : vrai seulement pour ORGANISATION', () => {
    expect(isOrgLevelConformite('ORGANISATION')).toBe(true)
    expect(isOrgLevelConformite('ANALYSE')).toBe(false)
    expect(isOrgLevelConformite('bidon')).toBe(false)
  })

  it('shouldSnapshotOnChange : vrai seulement en mode CHANGEMENT', () => {
    expect(shouldSnapshotOnChange('CHANGEMENT')).toBe(true)
    expect(shouldSnapshotOnChange('MANUEL')).toBe(false)
    expect(shouldSnapshotOnChange('AUTO')).toBe(false)
    expect(shouldSnapshotOnChange('x')).toBe(false)
  })

  it('dueForAutoSnapshot : jamais de snapshot → dû ; sinon selon la période', () => {
    const now = new Date('2026-07-04T00:00:00Z')
    expect(dueForAutoSnapshot(null, now, 30)).toBe(true)
    // il y a 40 jours → dû
    expect(dueForAutoSnapshot(new Date('2026-05-25T00:00:00Z'), now, 30)).toBe(true)
    // il y a 10 jours → pas dû
    expect(dueForAutoSnapshot(new Date('2026-06-24T00:00:00Z'), now, 30)).toBe(false)
    // exactement la période → dû
    expect(dueForAutoSnapshot(new Date('2026-06-04T00:00:00Z'), now, 30)).toBe(true)
  })
})
