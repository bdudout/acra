import { describe, it, expect } from 'vitest'
import {
  CONFORMITE_NIVEAUX,
  CONFORMITE_SNAPSHOT_MODES,
  DEFAULT_CONFORMITE_NIVEAU,
  sanitizeConformiteNiveau,
  sanitizeSnapshotMode,
  isOrgLevelConformite,
  isEntiteLevelConformite,
  usesConformiteEntity,
  shouldSnapshotOnChange,
  dueForAutoSnapshot,
  CONFORMITE_SNAPSHOT_PERIODES,
  DEFAULT_CONFORMITE_SNAPSHOT_PERIODE,
  sanitizeSnapshotPeriode,
  snapshotPeriodeDays,
} from '../../../lib/conformite-config'

describe('conformite-config — options Palier 2', () => {
  it('niveaux (org par défaut, + entité) et modes attendus', () => {
    expect(CONFORMITE_NIVEAUX).toEqual(['ORGANISATION', 'ANALYSE', 'ENTITE'])
    expect(DEFAULT_CONFORMITE_NIVEAU).toBe('ORGANISATION')
    expect(CONFORMITE_SNAPSHOT_MODES).toEqual(['MANUEL', 'AUTO', 'CHANGEMENT'])
  })

  it('sanitizeConformiteNiveau : valeur valide gardée, sinon défaut ORGANISATION', () => {
    expect(sanitizeConformiteNiveau('ORGANISATION')).toBe('ORGANISATION')
    expect(sanitizeConformiteNiveau('ANALYSE')).toBe('ANALYSE')
    expect(sanitizeConformiteNiveau('ENTITE')).toBe('ENTITE')
    expect(sanitizeConformiteNiveau('bidon')).toBe('ORGANISATION')
    expect(sanitizeConformiteNiveau(undefined)).toBe('ORGANISATION')
    expect(sanitizeConformiteNiveau(null)).toBe('ORGANISATION')
  })

  it('isEntiteLevelConformite / usesConformiteEntity', () => {
    expect(isEntiteLevelConformite('ENTITE')).toBe(true)
    expect(isEntiteLevelConformite('ORGANISATION')).toBe(false)
    // ORGANISATION et ENTITE vivent tous deux dans l'entité Conformite (org-level) ;
    // ANALYSE non (portée par l'analyse).
    expect(usesConformiteEntity('ORGANISATION')).toBe(true)
    expect(usesConformiteEntity('ENTITE')).toBe(true)
    expect(usesConformiteEntity('ANALYSE')).toBe(false)
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
    expect(isOrgLevelConformite('ENTITE')).toBe(false)
    // Valeur inconnue → défaut ORGANISATION (org-level).
    expect(isOrgLevelConformite('bidon')).toBe(true)
  })

  it('shouldSnapshotOnChange : vrai seulement en mode CHANGEMENT', () => {
    expect(shouldSnapshotOnChange('CHANGEMENT')).toBe(true)
    expect(shouldSnapshotOnChange('MANUEL')).toBe(false)
    expect(shouldSnapshotOnChange('AUTO')).toBe(false)
    expect(shouldSnapshotOnChange('x')).toBe(false)
  })

  it('périodes de snapshot : valeurs + jours + défaut MENSUEL', () => {
    expect(CONFORMITE_SNAPSHOT_PERIODES).toEqual(['MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL'])
    expect(DEFAULT_CONFORMITE_SNAPSHOT_PERIODE).toBe('MENSUEL')
    expect(sanitizeSnapshotPeriode('TRIMESTRIEL')).toBe('TRIMESTRIEL')
    expect(sanitizeSnapshotPeriode('bidon')).toBe('MENSUEL')
    expect(sanitizeSnapshotPeriode(undefined)).toBe('MENSUEL')
    expect(snapshotPeriodeDays('MENSUEL')).toBe(30)
    expect(snapshotPeriodeDays('TRIMESTRIEL')).toBe(91)
    expect(snapshotPeriodeDays('SEMESTRIEL')).toBe(182)
    expect(snapshotPeriodeDays('ANNUEL')).toBe(365)
    expect(snapshotPeriodeDays('bidon')).toBe(30) // défaut
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
