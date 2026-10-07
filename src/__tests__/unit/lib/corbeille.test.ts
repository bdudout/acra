/** Corbeille des éléments supprimés (incidents) : instantané fidèle, restauration à l'identique, rétention. */
import { describe, expect, it } from 'vitest'
import { instantaneIncident, restaurationIncident, corbeillePurgeable } from '@/lib/corbeille'

const incident = {
  id: 'inc1', organizationId: 'o', intitule: 'Panne du portail', description: null,
  dateSurvenance: new Date('2026-09-01T08:00:00.000Z'), dateDetection: null, montantBrut: { toString: () => '1234.50' }, recuperations: null,
  processusId: 'pr1', riskItemId: 'ri1', statut: 'QUALIFIE', declarantId: 'u1', doraCriteres: { a: true }, pertes: [{ m: 10 }],
  createdAt: new Date('2026-09-01T09:00:00.000Z'), updatedAt: new Date('2026-09-02T09:00:00.000Z'),
}

describe('corbeille — incident', () => {
  it('instantané JSON (dates ISO, montants en texte) et liens vers les risques', () => {
    const s = instantaneIncident(incident, ['ri1', 'ri2'])
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
    expect(s.incident).toMatchObject({ id: 'inc1', intitule: 'Panne du portail', dateSurvenance: '2026-09-01T08:00:00.000Z', montantBrut: '1234.50', recuperations: null })
    expect(s.risqueIds).toEqual(['ri1', 'ri2'])
  })
  it('restauration : même identifiant, dates reconstituées, références disparues retirées (processus, risques)', () => {
    const r = restaurationIncident(JSON.parse(JSON.stringify(instantaneIncident(incident, ['ri1', 'ri2']))), { processusIds: [], riskItemIds: ['ri2'] })
    expect(r.data).toMatchObject({ id: 'inc1', organizationId: 'o', intitule: 'Panne du portail', processusId: null, riskItemId: null, montantBrut: '1234.50', doraCriteres: { a: true } })
    expect(r.data.dateSurvenance).toEqual(new Date('2026-09-01T08:00:00.000Z'))
    expect(r.data.createdAt).toEqual(new Date('2026-09-01T09:00:00.000Z'))
    expect('updatedAt' in r.data).toBe(false)
    expect(r.risqueIds).toEqual(['ri2'])
  })
  it('purge au-delà de la rétention (30 jours)', () => {
    const now = new Date('2026-10-06T00:00:00Z')
    expect(corbeillePurgeable(new Date('2026-09-05T00:00:00Z'), now)).toBe(true)
    expect(corbeillePurgeable(new Date('2026-09-20T00:00:00Z'), now)).toBe(false)
  })
})
