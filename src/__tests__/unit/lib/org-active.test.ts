import { describe, it, expect } from 'vitest'
import { orgNameForPrefill } from '@/lib/org-active'

describe('orgNameForPrefill', () => {
  const memberships = [
    { organizationId: 'o1', nom: 'StarBank' },
    { organizationId: 'o2', nom: 'GalaxyInsurance' },
  ]
  it('renvoie le nom de l’org active', () => {
    expect(orgNameForPrefill('o1', memberships)).toBe('StarBank')
  })
  it('null pour l’org racine générique', () => {
    expect(orgNameForPrefill('global', memberships)).toBeNull()
  })
  it('null si absente, vide, ou entrées manquantes', () => {
    expect(orgNameForPrefill('o3', memberships)).toBeNull()
    expect(orgNameForPrefill('o1', [{ organizationId: 'o1', nom: '  ' }])).toBeNull()
    expect(orgNameForPrefill(null, memberships)).toBeNull()
    expect(orgNameForPrefill('o1', null)).toBeNull()
  })
})
