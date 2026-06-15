import { describe, it, expect } from 'vitest'
import {
  CONFORMITE_STATUTS,
  sanitizeConformite,
  deriveNonConformites,
  conformiteStats,
  type ConformiteEntry,
} from '@/lib/conformite'

const sample: ConformiteEntry[] = [
  { ref: '5.1', statut: 'conforme' },
  { ref: '5.2', statut: 'non_conforme', commentaire: 'Pas de revue' },
  { ref: '5.3', statut: 'partiel' },
  { ref: '5.4', statut: 'na' },
]

describe('CONFORMITE_STATUTS', () => {
  it('contient les 4 statuts attendus', () => {
    expect(CONFORMITE_STATUTS).toEqual(['conforme', 'partiel', 'non_conforme', 'na'])
  })
})

describe('sanitizeConformite', () => {
  it('ne garde que les entrées avec ref et statut valides', () => {
    const clean = sanitizeConformite([
      { ref: '5.1', statut: 'conforme' },
      { ref: '', statut: 'conforme' },
      { ref: '5.2', statut: 'bidon' as any },
      { ref: '5.3', statut: 'partiel', commentaire: 'x' },
    ])
    expect(clean.map(c => c.ref)).toEqual(['5.1', '5.3'])
  })

  it('filtre par refs autorisées si fournies', () => {
    const clean = sanitizeConformite(sample, new Set(['5.1', '5.2']))
    expect(clean.map(c => c.ref)).toEqual(['5.1', '5.2'])
  })

  it('tronque le commentaire et ignore une entrée non-objet', () => {
    const clean = sanitizeConformite([null as any, { ref: '5.1', statut: 'conforme', commentaire: 'a'.repeat(2000) }])
    expect(clean).toHaveLength(1)
    expect(clean[0].commentaire!.length).toBeLessThanOrEqual(1000)
  })

  it('renvoie [] pour une entrée non-tableau', () => {
    expect(sanitizeConformite(null as any)).toEqual([])
  })
})

describe('deriveNonConformites', () => {
  it('retient uniquement non_conforme et partiel', () => {
    const nc = deriveNonConformites(sample)
    expect(nc.map(c => c.ref).sort()).toEqual(['5.2', '5.3'])
  })

  it('exclut conforme et na', () => {
    const nc = deriveNonConformites(sample)
    expect(nc.find(c => c.ref === '5.1')).toBeUndefined()
    expect(nc.find(c => c.ref === '5.4')).toBeUndefined()
  })
})

describe('conformiteStats', () => {
  it('compte par statut et calcule le taux de conformité', () => {
    const s = conformiteStats(sample, 10)
    expect(s.conforme).toBe(1)
    expect(s.partiel).toBe(1)
    expect(s.nonConforme).toBe(1)
    expect(s.na).toBe(1)
    expect(s.evalues).toBe(4)
    expect(s.total).toBe(10)
    // taux = conforme / (évalués hors NA) = 1 / 3 → 33
    expect(s.tauxConformite).toBe(33)
  })

  it('taux = 0 si aucun contrôle pertinent évalué', () => {
    const s = conformiteStats([{ ref: '5.4', statut: 'na' }], 5)
    expect(s.tauxConformite).toBe(0)
  })
})
