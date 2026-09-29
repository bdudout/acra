/** Modèle de rapport (éditions figées) : périodes, cycle de validation quatre-yeux. */
import { describe, expect, it } from 'vitest'
import { RAPPORT_CATALOGUE, periodePreset, validerPeriode, transitionRapport, rapportsDisponibles, peutRegenerer } from '@/lib/rapport-model'

const now = new Date('2026-09-29T10:00:00Z')

describe('catalogue', () => {
  it('trois rapports livrés dans ce lot, chacun rattaché à un module', () => {
    expect(RAPPORT_CATALOGUE.map(r => r.code)).toEqual(['R-INC-1', 'R-PER-2', 'R-GRC-3'])
  })
  it('disponibilité selon les modules actifs de l’organisation', () => {
    expect(rapportsDisponibles({ incidentsActive: true }).map(r => r.code)).toEqual(['R-INC-1', 'R-PER-2'])
    expect(rapportsDisponibles({ registreRisquesActive: true }).map(r => r.code)).toEqual(['R-GRC-3'])
    expect(rapportsDisponibles({}).length).toBe(0)
  })
})

describe('périodes', () => {
  it('presets : mois précédent, trimestre précédent, année en cours et précédente (UTC, bornes incluses)', () => {
    expect(periodePreset('MOIS_PRECEDENT', now)).toEqual({ debut: '2026-08-01', fin: '2026-08-31' })
    expect(periodePreset('TRIMESTRE_PRECEDENT', now)).toEqual({ debut: '2026-04-01', fin: '2026-06-30' })
    expect(periodePreset('ANNEE_COURS', now)).toEqual({ debut: '2026-01-01', fin: '2026-12-31' })
    expect(periodePreset('ANNEE_PRECEDENTE', now)).toEqual({ debut: '2025-01-01', fin: '2025-12-31' })
    expect(periodePreset('TRIMESTRE_PRECEDENT', new Date('2026-02-10T00:00:00Z'))).toEqual({ debut: '2025-10-01', fin: '2025-12-31' })
  })
  it('validation : dates valides, début ≤ fin, durée ≤ 5 ans', () => {
    expect(validerPeriode({ debut: '2026-01-01', fin: '2026-03-31' })).toBeNull()
    expect(validerPeriode({ debut: 'nope', fin: '2026-03-31' })).toBe('periode_invalide')
    expect(validerPeriode({ debut: '2026-04-01', fin: '2026-03-31' })).toBe('periode_invalide')
    expect(validerPeriode({ debut: '2018-01-01', fin: '2026-03-31' })).toBe('periode_trop_longue')
  })
})

describe('cycle de validation', () => {
  const ctx = (o = {}) => ({ acteur: 'u2', createur: 'u1', secondeLigneActive: true, ...o })
  it('brouillon → relu → validé → diffusé, avec renvoi possible en brouillon', () => {
    expect(transitionRapport('BROUILLON', 'RELU', ctx())).toEqual({ ok: true })
    expect(transitionRapport('RELU', 'VALIDE', ctx())).toEqual({ ok: true })
    expect(transitionRapport('VALIDE', 'DIFFUSE', ctx())).toEqual({ ok: true })
    expect(transitionRapport('RELU', 'BROUILLON', ctx())).toEqual({ ok: true })
  })
  it('quatre-yeux : le créateur ne relit ni ne valide son propre rapport quand la 2ᵉ ligne est active', () => {
    expect(transitionRapport('BROUILLON', 'RELU', ctx({ acteur: 'u1' }))).toEqual({ ok: false, error: 'quatre_yeux' })
    expect(transitionRapport('RELU', 'VALIDE', ctx({ acteur: 'u1' }))).toEqual({ ok: false, error: 'quatre_yeux' })
  })
  it('mode ligne unique : validation directe et auto-validation permises (tracées côté API)', () => {
    expect(transitionRapport('BROUILLON', 'VALIDE', ctx({ acteur: 'u1', secondeLigneActive: false }))).toEqual({ ok: true })
    expect(transitionRapport('BROUILLON', 'VALIDE', ctx())).toEqual({ ok: false, error: 'transition_interdite' })
  })
  it('transitions interdites : sauts, retour depuis validé/diffusé', () => {
    for (const [a, b] of [['BROUILLON', 'DIFFUSE'], ['RELU', 'DIFFUSE'], ['VALIDE', 'BROUILLON'], ['DIFFUSE', 'VALIDE'], ['VALIDE', 'RELU']] as const) {
      expect(transitionRapport(a, b, ctx({ secondeLigneActive: false }))).toEqual({ ok: false, error: 'transition_interdite' })
    }
  })
  it('seul un brouillon (ou un rapport renvoyé) peut être regénéré ; jamais une édition validée', () => {
    expect(peutRegenerer('BROUILLON')).toBe(true)
    expect(['RELU', 'VALIDE', 'DIFFUSE'].some(s => peutRegenerer(s as never))).toBe(false)
  })
})
