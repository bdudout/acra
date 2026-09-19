import { it, expect } from 'vitest'
import { peutGererDocuments, peutGererReferentiels, peutEcrireAudit, peutPiloter, peutDefinir, peutDefinirKri, peutEvaluerDora, peutGererRegistreTic } from '@/lib/permissions'
it('préserve les droits des helpers extraits des routes Next', () => {
 expect(peutGererDocuments('DPO')).toBe(true)
 expect(peutGererDocuments('LECTEUR')).toBe(false)
 expect(peutGererReferentiels('RSSI')).toBe(false)
 expect(peutGererReferentiels('ADMIN')).toBe(true)
 expect(peutEcrireAudit('AUDITEUR')).toBe(true)
 expect(peutEcrireAudit('RSSI')).toBe(false)
 for (const fn of [peutPiloter, peutDefinir, peutDefinirKri]) {
  expect(fn('LECTEUR')).toBe(false)
  expect(fn('RSSI')).toBe(true)
  expect(fn('METIER', { secondeLigneActive: false })).toBe(true)
 }
 expect(peutEvaluerDora('RSSI')).toBe(true)
 expect(peutGererRegistreTic('LECTEUR')).toBe(false)
})
