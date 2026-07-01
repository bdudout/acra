import { describe, it, expect } from 'vitest'
import {
  QUALIFICATION_QUESTIONS,
  isQualificationComplete,
  deriveOrientations,
  sanitizeQualification,
  type QualificationAnswers,
} from '@/lib/qualification'

describe('QUALIFICATION_QUESTIONS', () => {
  it('définit un ensemble non vide de questions avec id et type', () => {
    expect(QUALIFICATION_QUESTIONS.length).toBeGreaterThan(0)
    for (const q of QUALIFICATION_QUESTIONS) {
      expect(q.id).toBeTruthy()
      expect(['bool', 'choice']).toContain(q.type)
      if (q.type === 'choice') expect((q.options ?? []).length).toBeGreaterThan(0)
    }
  })

  it('a des identifiants uniques', () => {
    const ids = QUALIFICATION_QUESTIONS.map(q => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('inclut au moins externalisation et criticité', () => {
    const ids = QUALIFICATION_QUESTIONS.map(q => q.id)
    expect(ids).toContain('externalisation')
    expect(ids).toContain('criticite')
  })
})

describe('isQualificationComplete', () => {
  it('vrai seulement si toutes les questions ont une réponse', () => {
    const partial: QualificationAnswers = { externalisation: true }
    expect(isQualificationComplete(partial)).toBe(false)
  })

  it('vrai quand chaque question a une valeur', () => {
    const full: QualificationAnswers = {}
    for (const q of QUALIFICATION_QUESTIONS) {
      full[q.id] = q.type === 'bool' ? false : q.options![0].value
    }
    expect(isQualificationComplete(full)).toBe(true)
  })

  it('faux pour un objet vide ou null', () => {
    expect(isQualificationComplete({})).toBe(false)
    expect(isQualificationComplete(null)).toBe(false)
  })
})

describe('deriveOrientations', () => {
  it('externalisation=true ⇒ orientation ECOSYSTEME', () => {
    const o = deriveOrientations({ externalisation: true })
    expect(o).toContain('ECOSYSTEME')
  })

  it('criticite=faible ⇒ ANALYSE_ALLEGEE, eleve ⇒ ANALYSE_APPROFONDIE', () => {
    expect(deriveOrientations({ criticite: 'faible' })).toContain('ANALYSE_ALLEGEE')
    expect(deriveOrientations({ criticite: 'eleve' })).toContain('ANALYSE_APPROFONDIE')
  })

  it('donneesPersonnelles=true ⇒ CONFIDENTIALITE, reglementation=true ⇒ CONFORMITE', () => {
    const o = deriveOrientations({ donneesPersonnelles: true, reglementation: true })
    expect(o).toContain('CONFIDENTIALITE')
    expect(o).toContain('CONFORMITE')
  })

  it('statut réglementaire (OSE/EEI/OIV) ⇒ CONFORMITE ; aucun ⇒ rien', () => {
    expect(deriveOrientations({ statutReglementaire: 'EEI' })).toContain('CONFORMITE')
    expect(deriveOrientations({ statutReglementaire: 'OIV' })).toContain('CONFORMITE')
    expect(deriveOrientations({ statutReglementaire: 'aucun' })).toEqual([])
  })

  it('aucune orientation pour des réponses neutres', () => {
    expect(deriveOrientations({ externalisation: false, criticite: 'modere', statutReglementaire: 'aucun' })).toEqual([])
  })

  it('ne duplique pas les orientations', () => {
    const o = deriveOrientations({ externalisation: true, criticite: 'eleve', donneesPersonnelles: true })
    expect(new Set(o).size).toBe(o.length)
  })
})

describe('sanitizeQualification', () => {
  it('ne conserve que les questions connues', () => {
    const clean = sanitizeQualification({ externalisation: true, inconnue: true } as any)
    expect(clean).toHaveProperty('externalisation', true)
    expect(clean).not.toHaveProperty('inconnue')
  })

  it('rejette les types invalides (bool attendu, choix hors options)', () => {
    const clean = sanitizeQualification({ externalisation: 'oui', criticite: 'enorme' } as any)
    expect(clean).not.toHaveProperty('externalisation')
    expect(clean).not.toHaveProperty('criticite')
  })

  it('accepte une valeur de choix valide', () => {
    const clean = sanitizeQualification({ criticite: 'eleve' })
    expect(clean).toHaveProperty('criticite', 'eleve')
  })

  it('conserve une filière OIV valide, rejette une invalide (issue #80)', () => {
    expect(sanitizeQualification({ filiereOiv: 'energie' })).toHaveProperty('filiereOiv', 'energie')
    expect(sanitizeQualification({ filiereOiv: 'xxx' } as any)).not.toHaveProperty('filiereOiv')
  })
  it('la filière OIV n’entre pas dans la complétude du questionnaire', () => {
    const full: any = { externalisation: true, criticite: 'modere', donneesPersonnelles: false, expositionInternet: true, reglementation: false, statutReglementaire: 'OIV', systemeIndustriel: false }
    expect(isQualificationComplete(full)).toBe(true) // sans filiereOiv
  })

  it('renvoie un objet vide pour une entrée non-objet', () => {
    expect(sanitizeQualification(null)).toEqual({})
    expect(sanitizeQualification('x' as any)).toEqual({})
  })
})
