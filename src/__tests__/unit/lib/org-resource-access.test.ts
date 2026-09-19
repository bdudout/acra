import { describe, it, expect } from 'vitest'
import { canReadOrgResource } from '@/lib/permissions'
describe('organisation resource scope', () => {
 it('refuse les périmètres absents ou vides, même global', () => {
   for (const id of ['global', 'other']) {
     expect(canReadOrgResource(id, undefined)).toBe(false)
     expect(canReadOrgResource(id, { visibleOrgIds: [], isSuperAdmin: false })).toBe(false)
   }
 })
 it('autorise uniquement le périmètre résolu, y compris un super-admin focalisé', () => {
   const scope = { visibleOrgIds: ['parent', 'child'], isSuperAdmin: false }
   expect(canReadOrgResource('child', scope)).toBe(true)
   expect(canReadOrgResource('other', scope)).toBe(false)
   expect(canReadOrgResource('global', scope)).toBe(false)
   expect(canReadOrgResource('other', { visibleOrgIds: [], isSuperAdmin: true })).toBe(true)
 })
})
