import { describe, expect, it } from 'vitest'
import { cleanUsageCriticality, usageCriticalityGap } from '@/lib/tier-offers'

describe('criticité d’un usage de service', () => {
  it('absente ou vide = non renseignée (null) ; valeur connue conservée ; inconnue refusée', () => {
    expect(cleanUsageCriticality(undefined)).toEqual({ ok: true, value: null })
    expect(cleanUsageCriticality('')).toEqual({ ok: true, value: null })
    expect(cleanUsageCriticality('CRITIQUE')).toEqual({ ok: true, value: 'CRITIQUE' })
    expect(cleanUsageCriticality('urgent')).toEqual({ ok: false, error: 'criticite_invalide' })
  })
  it('écart : un usage plus critique que le contrat qui le couvre est signalé (jamais l’inverse, jamais sans contrat)', () => {
    expect(usageCriticalityGap('CRITIQUE', 'NON_CRITIQUE')).toBe(true)
    expect(usageCriticalityGap('IMPORTANTE', 'NON_CRITIQUE')).toBe(true)
    expect(usageCriticalityGap('CRITIQUE', 'IMPORTANTE')).toBe(true)
    expect(usageCriticalityGap('IMPORTANTE', 'CRITIQUE')).toBe(false)
    expect(usageCriticalityGap('NON_CRITIQUE', 'NON_CRITIQUE')).toBe(false)
    expect(usageCriticalityGap(null, 'NON_CRITIQUE')).toBe(false)
    expect(usageCriticalityGap('CRITIQUE', null)).toBe(false)
  })
})

import { cleanCoverageDetails } from '@/lib/tier-offers'
describe('cleanCoverageDetails — périmètre et dates de couverture d’une offre sous un contrat', () => {
  it('accepte périmètre et dates valides, vide = non renseigné ; ignore les offres non couvertes', () => {
    const r = cleanCoverageDetails({ s1: { perimetre: '  Paie FR  ', dateDebut: '2025-01-01', dateFin: '2026-12-31' }, s2: {}, sX: { perimetre: 'hors sujet' } }, ['s1', 's2'])
    expect(r).toEqual({ ok: true, value: { s1: { perimetre: 'Paie FR', dateDebut: '2025-01-01', dateFin: '2026-12-31' }, s2: { perimetre: null, dateDebut: null, dateFin: null } } })
  })
  it('refuse une date invalide, une fin antérieure au début, un périmètre trop long', () => {
    expect(cleanCoverageDetails({ s1: { dateDebut: 'demain' } }, ['s1'])).toEqual({ ok: false, error: 'date_invalide' })
    expect(cleanCoverageDetails({ s1: { dateDebut: '2026-01-02', dateFin: '2026-01-01' } }, ['s1'])).toEqual({ ok: false, error: 'dates_incoherentes' })
    expect(cleanCoverageDetails({ s1: { perimetre: 'x'.repeat(2001) } }, ['s1'])).toEqual({ ok: false, error: 'perimetre_trop_long' })
  })
  it('absent : aucun détail (la couverture seule reste valable)', () => {
    expect(cleanCoverageDetails(undefined, ['s1'])).toEqual({ ok: true, value: {} })
  })
})
