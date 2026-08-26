import { describe, it, expect } from 'vitest'
import { prepareImport, API_IMPORT_MAX } from '@/lib/api-import'

// Validateur/nettoyeur factices (le vrai import réutilise les libs métier testées).
const validate = (i: { nom?: string }) => (i && typeof i.nom === 'string' && i.nom.trim() ? null : 'nom_requis')
const clean = (i: { nom: string }) => ({ nom: i.nom.trim().toUpperCase() })

describe('prepareImport', () => {
  it('sépare valides (nettoyés) et erreurs (par index)', () => {
    const r = prepareImport([{ nom: ' a ' }, { nom: '' }, { nom: 'b' }], validate, clean)
    expect(r.valid).toEqual([{ nom: 'A' }, { nom: 'B' }])
    expect(r.errors).toEqual([{ index: 1, error: 'nom_requis' }])
    expect(r.skipped).toBe(0)
  })
  it('cape la cardinalité et compte les ignorés', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ nom: `n${i}` }))
    const r = prepareImport(items, validate, clean, 10)
    expect(r.valid).toHaveLength(10)
    expect(r.skipped).toBe(2)
  })
  it('item malformé (validateur qui lève) → erreur, pas de crash', () => {
    const throwing = (i: { nom: string }) => (i.nom ? null : 'x') // lève sur null
    const r = prepareImport([null, { nom: 'ok' }], throwing, clean)
    expect(r.errors).toEqual([{ index: 0, error: 'item_invalide' }])
    expect(r.valid).toEqual([{ nom: 'OK' }])
  })
  it('entrée non-tableau → vide', () => {
    expect(prepareImport('x', validate, clean)).toEqual({ valid: [], errors: [], skipped: 0 })
  })
  it('cap par défaut = 500', () => {
    expect(API_IMPORT_MAX).toBe(500)
  })
})
