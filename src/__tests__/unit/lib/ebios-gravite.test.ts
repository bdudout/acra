import { describe, it, expect } from 'vitest'
import {
  graviteHeritee,
  valeursMetierConcernees,
  risqueSurevaluation,
  type ErLike,
} from '@/lib/ebios-gravite'

// ─────────────────────────────────────────────────────────────────────────────
// Héritage de la gravité des scénarios stratégiques — fiche méthode Club EBIOS
// « Définition de la gravité des scénarios stratégiques » (v1.0, 2025).
//
// Principes implémentés :
//  - la gravité d'un SS est HÉRITÉE des événements redoutés (ER) qui lui sont liés ;
//  - si plusieurs ER sont liés (même objectif visé), on retient la gravité MAX ;
//  - garde-fou : si les ER liés couvrent plusieurs valeurs métier de gravités
//    différentes, retenir le max surévalue le risque → on le signale (scinder le SS).
// ─────────────────────────────────────────────────────────────────────────────

const ERS: ErLike[] = [
  { id: 'er1', graviteDefaut: 3, valeurMetierId: 'vm-rd' },        // Information R&D
  { id: 'er2', graviteDefaut: 4, valeurMetierId: 'vm-vaccin' },    // Campagne vaccination
  { id: 'er3', graviteDefaut: 2, valeurMetierId: 'vm-rd' },        // autre ER même VM
  { id: 'er4', graviteDefaut: 4, valeurMetierId: 'vm-vaccin' },    // même VM, même gravité
]

describe('graviteHeritee — max des ER liés (règle de la fiche)', () => {
  it('retourne la gravité de l\'unique ER lié', () => {
    expect(graviteHeritee(['er1'], ERS)).toBe(3)
  })

  it('retient la gravité MAX quand plusieurs ER sont liés', () => {
    expect(graviteHeritee(['er1', 'er2'], ERS)).toBe(4)  // max(3,4)
    expect(graviteHeritee(['er1', 'er3'], ERS)).toBe(3)  // max(3,2)
  })

  it('retombe sur le fallback si aucun ER lié', () => {
    expect(graviteHeritee([], ERS, 2)).toBe(2)
    expect(graviteHeritee(['inconnu'], ERS, 1)).toBe(1)
  })

  it('borne le résultat à [1..4]', () => {
    expect(graviteHeritee(['x'], [{ id: 'x', graviteDefaut: 9 }])).toBe(4)
    expect(graviteHeritee(['x'], [{ id: 'x', graviteDefaut: 0 }], 2)).toBe(2)
  })

  it('accepte gravite ou graviteDefaut indifféremment', () => {
    expect(graviteHeritee(['a'], [{ id: 'a', gravite: 4 }])).toBe(4)
  })
})

describe('valeursMetierConcernees', () => {
  it('liste les valeurs métier distinctes des ER liés', () => {
    expect(valeursMetierConcernees(['er1', 'er2', 'er3'], ERS).sort()).toEqual(['vm-rd', 'vm-vaccin'])
  })
  it('vide si aucun ER lié', () => {
    expect(valeursMetierConcernees([], ERS)).toEqual([])
  })
})

describe('risqueSurevaluation — garde-fou anti-surévaluation', () => {
  it('faux pour un seul ER', () => {
    expect(risqueSurevaluation(['er1'], ERS)).toBe(false)
  })

  it('faux quand les ER partagent la même valeur métier', () => {
    expect(risqueSurevaluation(['er1', 'er3'], ERS)).toBe(false) // tous vm-rd
  })

  it('faux quand plusieurs VM mais gravités identiques', () => {
    // er2 (vm-vaccin,4) et un ER fictif (vm-rd,4) → 2 VM mais même gravité
    const ers = [{ id: 'a', graviteDefaut: 4, valeurMetierId: 'vm1' }, { id: 'b', graviteDefaut: 4, valeurMetierId: 'vm2' }]
    expect(risqueSurevaluation(['a', 'b'], ers)).toBe(false)
  })

  it('VRAI quand les ER couvrent plusieurs VM de gravités différentes (cas 4 vs 3 de la fiche)', () => {
    expect(risqueSurevaluation(['er1', 'er2'], ERS)).toBe(true) // vm-rd(3) + vm-vaccin(4)
  })
})
