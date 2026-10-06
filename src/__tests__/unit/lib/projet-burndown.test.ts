/** Plans d'action restants d'un projet : courbe prévue (jalons = échéances), ligne cible jusqu'à la mise en service, point du jour. */
import { describe, expect, it } from 'vitest'
import { burndownPlans } from '@/lib/projet-burndown'
import { sanitizeMeteo, METEOS } from '@/lib/projet-meteo'

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)

describe('burndownPlans', () => {
  it('prévu : plans restants après chaque jalon ; cible linéaire jusqu’à la mise en service ; restants aujourd’hui', () => {
    const b = burndownPlans({
      debut: d('2026-09-01'), miseEnService: d('2026-12-01'), now: d('2026-10-06'),
      plans: [
        { statut: 'FAIT', echeance: d('2026-09-15') },
        { statut: 'A_FAIRE', echeance: d('2026-10-01') }, // en retard
        { statut: 'EN_COURS', echeance: d('2026-11-01') },
        { statut: 'A_FAIRE', echeance: null },           // sans jalon : reste jusqu'au bout
      ],
    })!
    expect(b.total).toBe(4)
    expect(b.prevu.map(p => [p.date.toISOString().slice(0, 10), p.restants])).toEqual([
      ['2026-09-01', 4], ['2026-09-15', 3], ['2026-10-01', 2], ['2026-11-01', 1],
    ])
    expect(b.cible).toEqual([{ date: d('2026-09-01'), restants: 4 }, { date: d('2026-12-01'), restants: 0 }])
    expect(b.aujourdhui).toEqual({ date: d('2026-10-06'), restants: 3 })
    expect(b.fin).toEqual(d('2026-12-01'))
  })
  it('sans mise en service : fin = dernier jalon ; sans plan : null', () => {
    const b = burndownPlans({ debut: d('2026-09-01'), miseEnService: null, now: d('2026-10-06'), plans: [{ statut: 'A_FAIRE', echeance: d('2027-01-10') }] })!
    expect(b.fin).toEqual(d('2027-01-10'))
    expect(burndownPlans({ debut: d('2026-09-01'), miseEnService: null, now: d('2026-10-06'), plans: [] })).toBeNull()
  })
})

describe('météo projet', () => {
  it('quatre états, valeur inconnue rejetée', () => {
    expect(METEOS).toEqual(['SOLEIL', 'SOLEIL_NUAGE', 'NUAGE', 'ORAGE'])
    expect(sanitizeMeteo('ORAGE')).toBe('ORAGE')
    expect(sanitizeMeteo('')).toBeNull()
    expect(sanitizeMeteo('TEMPETE')).toBeUndefined()
  })
})
