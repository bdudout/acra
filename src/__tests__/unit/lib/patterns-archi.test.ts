// Patterns d'architecture de SI (docs/specs/patterns-architecture-besoins.md, lot A1) : référentiel, normalisation, plafond.
import { describe, it, expect } from 'vitest'
import { ARCHI_PATTERNS, PATTERN_FAMILIES, PATTERNS_MAX_DEFAULT, PATTERNS_MAX_MIN, PATTERNS_MAX_MAX, patternLabel, patternHelp, isPatternCode, normalizePatterns, parseImportedPatterns, patternsOf, clampPatternsMax, patternsByFamily, LOT1_CODES, validateInitialAnalysisContext } from '@/lib/patterns-archi'

const LOCALES = ['fr', 'en', 'de', 'es', 'it'] as const

describe('référentiel', () => {
  it('25 patterns en 5 familles, codes uniques en MAJUSCULES stables', () => {
    expect(ARCHI_PATTERNS).toHaveLength(25)
    expect(new Set(ARCHI_PATTERNS.map(p => p.code)).size).toBe(25)
    expect(PATTERN_FAMILIES).toHaveLength(5)
    for (const p of ARCHI_PATTERNS) { expect(p.code).toMatch(/^[A-Z][A-Z0-9_]+$/); expect(PATTERN_FAMILIES.map(f => f.id)).toContain(p.family) }
  })
  it('16 patterns marqués « Lot 1 », dont le socle SI standard obligatoire à la création', () => {
    expect(LOT1_CODES).toHaveLength(16)
    for (const c of ['SI_STANDARD', 'EXPOSITION_INTERNET', 'DMZ', 'ZONE_CONFIANCE', 'ZONE_MOINDRE_CONFIANCE', 'INTERCO_TIERS', 'EXTERNALISATION_DONNEES', 'TELEMAINTENANCE', 'SI_ADMINISTRATION', 'FLUX_INTERNES_DC', 'BUREAUTIQUE', 'SI_TPE', 'SI_SENSIBLE']) expect(LOT1_CODES).toContain(c)
  })
  it('libellés et aides non vides dans les 5 langues, distincts du français hors noms propres', () => {
    for (const p of ARCHI_PATTERNS) for (const l of LOCALES) {
      expect(patternLabel(p.code, l).trim().length, `${p.code}/${l}`).toBeGreaterThan(2)
      expect(patternHelp(p.code, l).trim().length, `${p.code}/${l} aide`).toBeGreaterThan(10)
    }
    expect(patternLabel('DMZ', 'en')).not.toBe(patternLabel('DMZ', 'fr'))
  })
  it('patternsByFamily : toutes les familles, tous les patterns, ordre du référentiel', () => {
    const g = patternsByFamily()
    expect(g.map(x => x.family.id)).toEqual(PATTERN_FAMILIES.map(f => f.id))
    expect(g.flatMap(x => x.patterns).length).toBe(25)
  })
  it('code inconnu : isPatternCode faux, libellé = code (jamais d’exception)', () => {
    expect(isPatternCode('DMZ')).toBe(true); expect(isPatternCode('PIRATE')).toBe(false); expect(isPatternCode(3)).toBe(false)
    expect(patternLabel('PIRATE', 'fr')).toBe('PIRATE')
  })
})

describe('normalizePatterns', () => {
  it('ignore les codes inconnus et non-chaînes, retire les doublons, conserve l’ordre', () => {
    expect(normalizePatterns(['DMZ', 'PIRATE', 'DMZ', 3, 'SI_TPE', null])).toEqual(['DMZ', 'SI_TPE'])
  })
  it('entrée non liste : liste vide', () => { expect(normalizePatterns(undefined)).toEqual([]); expect(normalizePatterns('DMZ')).toEqual([]) })
  it('plafond : refus de dépasser (valeur par défaut 12, ou plafond fourni)', () => {
    const codes = ARCHI_PATTERNS.map(p => p.code)
    expect(normalizePatterns(codes.slice(0, 12))).toHaveLength(12)
    expect(() => normalizePatterns(codes.slice(0, 13), { max: 12, strict: true })).toThrow('patterns_too_many')
    expect(normalizePatterns(codes.slice(0, 13), { max: 6 })).toHaveLength(6)
    expect(() => normalizePatterns(codes.slice(0, 7), { max: 6, strict: true })).toThrow('patterns_too_many')
  })
})

describe('plafond configurable', () => {
  it('défaut 12 ; borné de 1 à 25 ; valeur invalide = défaut', () => {
    expect(PATTERNS_MAX_DEFAULT).toBe(12); expect(PATTERNS_MAX_MIN).toBe(1); expect(PATTERNS_MAX_MAX).toBe(25)
    expect(clampPatternsMax(6)).toBe(6); expect(clampPatternsMax(0)).toBe(1); expect(clampPatternsMax(99)).toBe(25)
    expect(clampPatternsMax('x')).toBe(12); expect(clampPatternsMax(null)).toBe(12); expect(clampPatternsMax(7.8)).toBe(7)
  })
})

describe('contexte requis à la création', () => {
  it('refuse un secteur vide et toute sélection de patterns vide ou inconnue', () => {
    expect(validateInitialAnalysisContext({ secteur: ' ', patterns: ['SI_STANDARD'] })).toBe('sector_required')
    expect(validateInitialAnalysisContext({ secteur: 'Santé', patterns: [] })).toBe('pattern_required')
    expect(validateInitialAnalysisContext({ secteur: 'Santé', patterns: ['INCONNU'] })).toBe('pattern_required')
  })
  it('accepte un secteur et le pattern de repli SI standard', () => {
    expect(validateInitialAnalysisContext({ secteur: 'Santé', patterns: ['SI_STANDARD'] })).toBeNull()
  })
})

describe('patternsOf', () => {
  it('lit la colonne JSON d’une analyse, assainie ; absente = []', () => {
    expect(patternsOf({ patternsArchi: ['DMZ', 'X', 'DMZ'] })).toEqual(['DMZ'])
    expect(patternsOf({})).toEqual([]); expect(patternsOf(null)).toEqual([]); expect(patternsOf({ patternsArchi: 'DMZ' })).toEqual([])
  })
})

describe('parseImportedPatterns', () => {
  it('reconnaît les codes ou les libellés des cinq langues, séparés explicitement, sans inventer de pattern', () => {
    expect(parseImportedPatterns('EXPOSITION_INTERNET ; Interconnexion avec un tiers | Internet exposure\nInconnu')).toEqual(['EXPOSITION_INTERNET', 'INTERCO_TIERS'])
  })
})
