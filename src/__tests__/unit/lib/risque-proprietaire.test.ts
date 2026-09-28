// P3 — propriétaire du risque (ISO/IEC 27005:2022 §7.2.2) : personne ou entité.
import { describe, expect, it } from 'vitest'
import { sanitizeProprietaire, ownerSuggestions, ownerFilterOptions, filterByOwner, OWNER_NONE } from '@/lib/risque-proprietaire'
import { sanitizeDirectRisque, sanitizeDirectRisquePatch } from '@/lib/risque-direct'

describe('sanitizeProprietaire', () => {
  it('texte nettoyé et borné ; vide → null', () => {
    expect(sanitizeProprietaire('  Directeur des SI  ')).toBe('Directeur des SI')
    expect(sanitizeProprietaire('   ')).toBeNull()
    expect(sanitizeProprietaire(42)).toBeNull()
    expect(sanitizeProprietaire('x'.repeat(300))).toHaveLength(200)
  })
  it('est pris en compte à la création et en mise à jour (effacement possible)', () => {
    expect(sanitizeDirectRisque({ nom: 'r', proprietaire: ' RSSI ' })).toMatchObject({ proprietaire: 'RSSI' })
    expect(sanitizeDirectRisquePatch({ proprietaire: '' })).toEqual({ proprietaire: null })
    expect(sanitizeDirectRisquePatch({ nom: 'x' })).not.toHaveProperty('proprietaire')
  })
})

describe('ownerSuggestions', () => {
  it('noms des membres + entités, dédoublonnés (casse) et triés, sans valeur vide', () => {
    expect(ownerSuggestions(['Alice Martin', null, 'bob', ' '], ['DSI', 'Métier', 'dsi'])).toEqual(['Alice Martin', 'bob', 'DSI', 'Métier'])
  })
})

describe('filtre par propriétaire', () => {
  const rows = [{ id: 'a', proprietaire: 'DSI' }, { id: 'b', proprietaire: null }, { id: 'c', proprietaire: 'Alice' }, { id: 'd', proprietaire: 'DSI' }]
  it('options = propriétaires présents, triés', () => {
    expect(ownerFilterOptions(rows)).toEqual(['Alice', 'DSI'])
  })
  it('tous / sans propriétaire / un propriétaire', () => {
    expect(filterByOwner(rows, '').map(r => r.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(filterByOwner(rows, OWNER_NONE).map(r => r.id)).toEqual(['b'])
    expect(filterByOwner(rows, 'DSI').map(r => r.id)).toEqual(['a', 'd'])
  })
})
