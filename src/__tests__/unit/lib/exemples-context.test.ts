import { describe, it, expect } from 'vitest'
import { vocabForSecteur, scoreExemple, rankExemples } from '@/lib/exemples-context'

// ─────────────────────────────────────────────────────────────────────────────
// Exemples contextuels : réordonner les exemples proposés dans les ateliers selon
// le secteur et les réponses précédentes (mots-clés), sans rien supprimer.
// Stratégie heuristique (pas de tag sur le catalogue) — module pur, testé.
// ─────────────────────────────────────────────────────────────────────────────

describe('vocabForSecteur', () => {
  it('renvoie un vocabulaire santé pour un secteur santé (variantes)', () => {
    const v = vocabForSecteur('Santé / Hôpital public')
    expect(v).toContain('patient')
    expect(v.length).toBeGreaterThan(3)
  })
  it('renvoie un vocabulaire bancaire pour Banque / Finance', () => {
    expect(vocabForSecteur('Banque / Finance')).toContain('paiement')
  })
  it('renvoie un vocabulaire OT pour Industrie / Énergie', () => {
    expect(vocabForSecteur('Industrie / Manufacturing')).toContain('scada')
    expect(vocabForSecteur('Énergie / Utilities')).toContain('scada')
  })
  it('renvoie [] pour secteur inconnu / vide', () => {
    expect(vocabForSecteur('')).toEqual([])
    expect(vocabForSecteur(null)).toEqual([])
    expect(vocabForSecteur('Secteur exotique')).toEqual([])
  })
})

describe('scoreExemple — recouvrement de mots-clés (insensible à la casse)', () => {
  const kw = ['patient', 'prescription', 'dpi']
  it('compte les mots-clés présents dans nom + description + impacts', () => {
    expect(scoreExemple({ nom: 'Dossier Patient Informatisé (DPI)', description: 'Prescriptions' }, kw)).toBe(3)
    expect(scoreExemple({ nom: 'Gestion des commandes', description: 'Facturation' }, kw)).toBe(0)
    expect(scoreExemple({ description: 'Suivi patient' }, kw)).toBe(1)
    expect(scoreExemple({ nom: 'X', impacts: ['Atteinte au patient'] }, kw)).toBe(1)
  })
  it('0 si aucun mot-clé', () => {
    expect(scoreExemple({ nom: 'abc' }, [])).toBe(0)
  })
})

describe('rankExemples — réordonne (pertinents en tête), non destructif', () => {
  const exemples = [
    { nom: 'Gestion des commandes clients', description: 'Facturation' },
    { nom: 'Dossier patient', description: 'Données médicales' },
    { nom: 'Annuaire' },
    { nom: 'Prescription médicamenteuse', description: 'circuit du médicament' },
  ]
  it('met les exemples pertinents (secteur santé) en tête et les marque', () => {
    const r = rankExemples(exemples, { secteur: 'Santé / Hôpital public' })
    expect(r).toHaveLength(exemples.length) // rien supprimé
    expect(r[0].pertinent).toBe(true)
    expect(r[0].nom).toMatch(/patient|prescription/i)
    // les non pertinents sont en fin et marqués false
    expect(r.some(e => e.pertinent === false)).toBe(true)
  })
  it('tri stable : conserve l\'ordre d\'origine à score égal', () => {
    const r = rankExemples(exemples, { secteur: '' }) // aucun vocab → tous score 0
    expect(r.map(e => e.nom)).toEqual(exemples.map(e => e.nom))
    expect(r.every(e => e.pertinent === false)).toBe(true)
  })
  it('prend en compte les mots-clés des réponses précédentes (extraKeywords)', () => {
    const r = rankExemples(exemples, { secteur: '', extraKeywords: ['commandes'] })
    expect(r[0].nom).toBe('Gestion des commandes clients')
    expect(r[0].pertinent).toBe(true)
  })
  it('ne modifie pas le tableau source', () => {
    const copy = [...exemples]
    rankExemples(exemples, { secteur: 'Santé' })
    expect(exemples).toEqual(copy)
  })
})
