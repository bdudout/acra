import { describe, it, expect } from 'vitest'
import {
  sanitizeQualificationConfig, effectiveQualificationQuestions,
  sanitizeQualification, isQualificationComplete, EMPTY_QUALIFICATION_CONFIG,
} from '@/lib/qualification'

describe('sanitizeQualificationConfig', () => {
  it('ne garde que des overrides de questions natives connues', () => {
    const c = sanitizeQualificationConfig({
      overrides: { criticite: { label: 'Criticité métier', enabled: false }, inconnue: { label: 'x' } },
      custom: [],
    })
    expect(c.overrides.criticite).toEqual({ label: 'Criticité métier', enabled: false })
    expect(c.overrides.inconnue).toBeUndefined()
  })

  it('nettoie les questions personnalisées (id slug, type, options, pas de collision native)', () => {
    const c = sanitizeQualificationConfig({
      overrides: {},
      custom: [
        { id: 'Budget Cyber!', label: 'Budget dédié ?', type: 'bool' },
        { id: 'maturite', label: 'Maturité', type: 'choice', options: [{ value: 'faible', label: 'Faible' }, { value: 'haute', label: 'Haute' }] },
        { id: 'criticite', label: 'collision native', type: 'bool' }, // ignoré (id natif)
        { id: 'vide', label: '', type: 'bool' }, // ignoré (label vide)
      ],
    })
    expect(c.custom.map(q => q.id)).toEqual(['budget-cyber', 'maturite'])
    expect(c.custom[1].options?.map(o => o.value)).toEqual(['faible', 'haute'])
  })
})

describe('effectiveQualificationQuestions', () => {
  it('natives activées + personnalisées ; une native désactivée disparaît', () => {
    const c = sanitizeQualificationConfig({
      overrides: { rssiInterne: { enabled: false } },
      custom: [{ id: 'budget', label: 'Budget', type: 'bool' }],
    })
    const qs = effectiveQualificationQuestions(c)
    const ids = qs.map(q => q.id)
    expect(ids).toContain('criticite')
    expect(ids).not.toContain('rssiInterne') // désactivée
    expect(ids).toContain('budget')          // personnalisée
    expect(qs.find(q => q.id === 'budget')?.builtin).toBe(false)
  })
})

describe('sanitizeQualification (avec config)', () => {
  it('accepte les réponses aux questions personnalisées et exclut les natives désactivées', () => {
    const c = sanitizeQualificationConfig({
      overrides: { externalisation: { enabled: false } },
      custom: [{ id: 'budget', label: 'Budget', type: 'bool' }, { id: 'maturite', label: 'M', type: 'choice', options: [{ value: 'haute', label: 'H' }, { value: 'basse', label: 'B' }] }],
    })
    const out = sanitizeQualification({ externalisation: true, criticite: 'eleve', budget: true, maturite: 'haute', maturite_bad: 'x' }, c)
    expect(out.externalisation).toBeUndefined() // native désactivée
    expect(out.criticite).toBe('eleve')
    expect(out.budget).toBe(true)
    expect(out.maturite).toBe('haute')
  })
  it('rétrocompatible : sans config, comportement natif inchangé', () => {
    const out = sanitizeQualification({ criticite: 'eleve', budget: true })
    expect(out.criticite).toBe('eleve')
    expect((out as Record<string, unknown>).budget).toBeUndefined()
  })
})

describe('isQualificationComplete (avec config)', () => {
  it('exige les natives activées + les personnalisées', () => {
    const c = sanitizeQualificationConfig({ overrides: {}, custom: [{ id: 'budget', label: 'B', type: 'bool' }] })
    const base: Record<string, boolean | string> = {
      externalisation: true, criticite: 'eleve', donneesPersonnelles: true, expositionInternet: true,
      reglementation: false, statutReglementaire: 'aucun', systemeIndustriel: false, rssiInterne: true,
    }
    expect(isQualificationComplete(base, c)).toBe(false) // budget manquant
    expect(isQualificationComplete({ ...base, budget: true }, c)).toBe(true)
  })
  it('config vide = EMPTY (natives seules)', () => {
    expect(EMPTY_QUALIFICATION_CONFIG).toEqual({ overrides: {}, custom: [] })
  })
})
