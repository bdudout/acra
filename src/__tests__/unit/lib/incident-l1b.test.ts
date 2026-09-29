/** Incident L1 (suite) : chronologie, cause racine, impacts non financiers, allocation des pertes. */
import { describe, expect, it } from 'vitest'
import { TYPES_CHRONOLOGIE, CAUSES_RACINE, UNITES_IMPACT, sanitizeChronologie, sanitizeImpacts, sanitizeAllocations, allouer, cleanCauseRacine } from '@/lib/incident-l1b'
import { validateIncidentInput, cleanIncidentInput } from '@/lib/incident'

describe('chronologie', () => {
  it('catalogue, entrées valides triées par date, texte borné, plafond', () => {
    expect(TYPES_CHRONOLOGIE).toEqual(['DETECTION', 'ESCALADE', 'CONFINEMENT', 'RETABLISSEMENT', 'COMMUNICATION', 'AUTRE'])
    const c = sanitizeChronologie([
      { type: 'RETABLISSEMENT', date: '2026-09-02T10:00:00Z', texte: ' Service rétabli ' },
      { type: 'DETECTION', date: '2026-09-01T08:00:00Z', texte: 'Alerte SIEM' },
      { type: 'BIZARRE', date: '2026-09-01T09:00:00Z', texte: 'x' }, { type: 'AUTRE', date: 'nope', texte: 'x' }, { type: 'AUTRE', date: '2026-09-01', texte: '' }, null,
    ])
    expect(c.map(e => e.type)).toEqual(['DETECTION', 'RETABLISSEMENT'])
    expect(c[1].texte).toBe('Service rétabli')
    expect(sanitizeChronologie(Array.from({ length: 80 }, (_, i) => ({ type: 'AUTRE', date: '2026-01-01', texte: `e${i}` })))).toHaveLength(50)
    expect(sanitizeChronologie('x')).toEqual([])
  })
})

describe('cause racine', () => {
  it('catalogue Bâle (processus, personnes, systèmes, externe) + tiers ; valeur inconnue → null', () => {
    expect(CAUSES_RACINE).toEqual(['PROCESSUS', 'PERSONNES', 'SYSTEMES', 'EXTERNE', 'TIERS'])
    expect(cleanCauseRacine('SYSTEMES')).toBe('SYSTEMES')
    expect(cleanCauseRacine('nope')).toBeNull()
  })
})

describe('impacts non financiers', () => {
  it('unités connues (ou code libre valide), valeurs ≥ 0, une valeur par unité', () => {
    expect(UNITES_IMPACT).toEqual(['JOURS_ARRET', 'CLIENTS_TOUCHES', 'DONNEES_EXPOSEES', 'PATIENTS_TOUCHES', 'AUTRE'])
    expect(sanitizeImpacts([{ unite: 'JOURS_ARRET', valeur: 3 }, { unite: 'JOURS_ARRET', valeur: 5 }, { unite: 'CLIENTS_TOUCHES', valeur: -1 }, { unite: 'x y', valeur: 2 }, { unite: 'PATIENTS_TOUCHES', valeur: '12' }]))
      .toEqual([{ unite: 'JOURS_ARRET', valeur: 5 }, { unite: 'AUTRE', valeur: 2 }, { unite: 'PATIENTS_TOUCHES', valeur: 12 }])
  })
})

describe('allocation des pertes entre entités / lignes de métier', () => {
  it('nettoyage : pourcentages 0-100, somme ≤ 100 sinon rejet', () => {
    expect(sanitizeAllocations([{ entite: ' Filiale Nord ', pct: 60 }, { entite: 'Siège', ligneMetier: 'Banque de détail', pct: 40 }]))
      .toEqual({ ok: true, allocations: [{ entite: 'Filiale Nord', pct: 60 }, { entite: 'Siège', ligneMetier: 'Banque de détail', pct: 40 }] })
    expect(sanitizeAllocations([{ entite: 'A', pct: 70 }, { entite: 'B', pct: 50 }])).toEqual({ ok: false, error: 'allocation_invalide' })
    expect(sanitizeAllocations([{ entite: '', pct: 10 }, { entite: 'A', pct: -5 }, null])).toEqual({ ok: true, allocations: [] })
  })
  it('répartition : arrondi au centime, le reliquat non alloué revient à l’entité d’origine, total conservé', () => {
    const r = allouer(1000, [{ entite: 'A', pct: 33.33 }, { entite: 'B', pct: 33.33 }], 'Siège')
    expect(r.reduce((s, x) => s + x.montant, 0)).toBeCloseTo(1000, 2)
    expect(r.map(x => x.entite)).toEqual(['A', 'B', 'Siège'])
    expect(r[2].montant).toBeCloseTo(333.4, 2)
    expect(allouer(500, [], 'Siège')).toEqual([{ entite: 'Siège', ligneMetier: undefined, montant: 500 }])
    expect(allouer(0, [{ entite: 'A', pct: 100 }], 'Siège')).toEqual([{ entite: 'A', ligneMetier: undefined, montant: 0 }])
  })
})

describe('intégration dans la déclaration', () => {
  it('clean : champs nettoyés ; validate : allocation > 100 % refusée', () => {
    const c = cleanIncidentInput({ intitule: 'X', causeRacine: 'TIERS', causeDetail: ' Prestataire défaillant ', leconsApprises: 'Revoir le contrat',
      chronologie: [{ type: 'DETECTION', date: '2026-09-01T08:00:00Z', texte: 'Alerte' }], impactsNonFinanciers: [{ unite: 'JOURS_ARRET', valeur: 2 }], allocations: [{ entite: 'A', pct: 100 }] })
    expect([c.causeRacine, c.causeDetail, c.leconsApprises]).toEqual(['TIERS', 'Prestataire défaillant', 'Revoir le contrat'])
    expect(c.chronologie).toHaveLength(1); expect(c.impactsNonFinanciers).toEqual([{ unite: 'JOURS_ARRET', valeur: 2 }]); expect(c.allocations).toEqual([{ entite: 'A', pct: 100 }])
    expect(validateIncidentInput({ intitule: 'X', allocations: [{ entite: 'A', pct: 80 }, { entite: 'B', pct: 80 }] })).toBe('allocation_invalide')
    expect(validateIncidentInput({ intitule: 'X', allocations: [{ entite: 'A', pct: 50 }] })).toBeNull()
  })
})
