import { describe, it, expect } from 'vitest'
import {
  TRAITEMENT_TYPES, isTraitementType, entryTagForType, typeForEntryTag, sanitizeRefs,
} from '@/lib/conformite-traitement'

describe('conformite-traitement', () => {
  it('mappe type ↔ étiquette d\'entrée de manière cohérente (aller-retour)', () => {
    for (const t of TRAITEMENT_TYPES) {
      expect(typeForEntryTag(entryTagForType(t))).toBe(t)
    }
    expect(entryTagForType('DEROGATION')).toBe('derogation')
    expect(entryTagForType('PLAN_ACTION')).toBe('plan_action')
    expect(entryTagForType('ACCEPTATION_RISQUE')).toBe('acceptation_risque')
  })

  it('valide les types de traitement', () => {
    expect(isTraitementType('DEROGATION')).toBe(true)
    expect(isTraitementType('bidon')).toBe(false)
    expect(isTraitementType(null)).toBe(false)
  })

  it('sanitize les refs : chaînes non vides, uniques, bornées', () => {
    expect(sanitizeRefs(['A.5.1', ' A.5.1 ', '', '  ', 'A.8.2', 42])).toEqual(['A.5.1', 'A.8.2'])
    expect(sanitizeRefs('pas un tableau')).toEqual([])
    expect(sanitizeRefs(['x'.repeat(80)])[0]).toHaveLength(60)
  })
})
