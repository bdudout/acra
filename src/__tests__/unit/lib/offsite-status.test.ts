// Sauvegarde externe — état publié par scripts/acra-offsite.sh (.acra-update/offsite.json), assaini, et verdict d'âge.
import { describe, it, expect } from 'vitest'
import { parseOffsiteState, offsiteHealth } from '@/lib/offsite-status'

const now = new Date('2026-10-04T12:00:00Z')
const ok = { schema: 1, driver: 's3', lastSnapshotId: '20261003T101500Z-pre-update-1.0.4', lastSuccessAt: '2026-10-04T08:00:00Z', lastFailureAt: null, lastCode: 0, updatedAt: '2026-10-04T08:00:00Z' }

describe('parseOffsiteState', () => {
  it('garde les champs connus, borne les textes, écarte l’inconnu', () => {
    const s = parseOffsiteState({ ...ok, secret: 'x', driver: 's3' })
    expect(s).toEqual({ driver: 's3', lastSnapshotId: ok.lastSnapshotId, lastSuccessAt: ok.lastSuccessAt, lastFailureAt: null, lastCode: 0 })
  })
  it('refuse un schéma, un pilote ou un code invalide ; identifiant de point invalide écarté', () => {
    expect(parseOffsiteState({ ...ok, schema: 2 })).toBeNull()
    expect(parseOffsiteState({ ...ok, driver: 'rm -rf' })).toBeNull()
    expect(parseOffsiteState({ ...ok, lastCode: 'x' })).toBeNull()
    expect(parseOffsiteState({ ...ok, lastSnapshotId: '../x' })?.lastSnapshotId).toBeNull()
    expect(parseOffsiteState(null)).toBeNull()
  })
})

describe('offsiteHealth', () => {
  const parsed = (o: object) => parseOffsiteState({ ...ok, ...o })
  it('OK : dernier envoi récent', () => expect(offsiteHealth(parsed({}), now, 48)).toEqual({ status: 'OK', ageHours: 4 }))
  it('LATE : plus vieux que le seuil', () => expect(offsiteHealth(parsed({ lastSuccessAt: '2026-10-01T00:00:00Z' }), now, 48).status).toBe('LATE'))
  it('FAILED : échec postérieur au dernier succès, ou aucun succès', () => {
    expect(offsiteHealth(parsed({ lastFailureAt: '2026-10-04T09:00:00Z', lastCode: 51 }), now, 48).status).toBe('FAILED')
    expect(offsiteHealth(parsed({ lastSuccessAt: null, lastSnapshotId: null, lastCode: 50 }), now, 48).status).toBe('FAILED')
  })
  it('un succès postérieur à un ancien échec : OK', () => expect(offsiteHealth(parsed({ lastFailureAt: '2026-10-03T00:00:00Z' }), now, 48).status).toBe('OK'))
  it('NONE : pas de configuration', () => expect(offsiteHealth(null, now, 48).status).toBe('NONE'))
})
