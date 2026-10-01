import { describe, it, expect } from 'vitest'
import { exerceRole, canCreateAnalyse, canSubmitAnalyse, canApproveAnalyse, canAutoValidateAnalyse } from '@/lib/permissions'
import { applyApprobation } from '@/lib/projet360'
import { canAvisRssiDerogation, canDoubleRegardDerogation, canValiderDerogation } from '@/lib/derogation'
import { approbateursAnalyse, valideursDerogation } from '@/lib/relances'

const PS = { petiteStructure: true }
const rssi = { id: 'u1', role: 'RSSI' as const }
const rm = { id: 'u2', role: 'RISK_MANAGER' as const }
const sienne = { userId: 'u1', accesUtilisateurs: [] }

describe('petite structure : cumul RSSI + gestionnaire des risques + analyste', () => {
  it('exerceRole : cumul seulement pour RSSI et gestionnaire des risques, seulement en petite structure', () => {
    expect(exerceRole('RSSI', 'ANALYSTE')).toBe(false)
    expect(exerceRole('RSSI', 'ANALYSTE', PS)).toBe(true)
    expect(exerceRole('RISK_MANAGER', 'RSSI', PS)).toBe(true)
    expect(exerceRole('RSSI', 'DIRECTION_METIER', PS)).toBe(false)
    expect(exerceRole('ANALYSTE', 'RSSI', PS)).toBe(false)
    expect(exerceRole('CONTROLEUR', 'ANALYSTE', PS)).toBe(false)
    // L'administrateur d'une petite structure (souvent la même personne) exerce aussi RSSI et gestionnaire des risques.
    expect(exerceRole('ADMIN', 'RSSI', PS)).toBe(true)
    expect(exerceRole('ADMIN', 'RSSI')).toBe(false)
    expect(exerceRole('ADMIN', 'DIRECTION_METIER', PS)).toBe(false)
  })
  it('analyses : le RSSI crée, soumet et approuve la sienne ; jamais hors petite structure', () => {
    expect(canCreateAnalyse(rssi)).toBe(false)
    expect(canCreateAnalyse(rssi, PS)).toBe(true)
    expect(canSubmitAnalyse(rssi, sienne)).toBe(false)
    expect(canSubmitAnalyse(rssi, sienne, PS)).toBe(true)
    expect(canApproveAnalyse(rssi, sienne)).toBe(false)
    expect(canApproveAnalyse(rssi, sienne, PS)).toBe(true)
    expect(canAutoValidateAnalyse(rssi, sienne, 3)).toBe(false)
    expect(canAutoValidateAnalyse(rssi, sienne, 3, PS)).toBe(true)
    // Un analyste ne gagne aucun droit d'approbation.
    expect(canApproveAnalyse({ id: 'u3', role: 'ANALYSTE' }, { userId: 'u9', accesUtilisateurs: [] }, PS)).toBe(false)
  })
  it('projet 360 : une seule approbation suffit en cumul, tracée comme telle', () => {
    const r = applyApprobation([], { userId: 'u1', role: 'RSSI' }, new Date('2026-10-01'), PS)
    expect(r).toMatchObject({ ok: true, complete: true, approbations: [{ role: 'RSSI', userId: 'u1', cumul: true }] })
    expect(applyApprobation([], { userId: 'u1', role: 'RSSI' }, new Date('2026-10-01'))).toMatchObject({ ok: true, complete: false })
  })
  it('dérogations : avis RSSI et double regard par le gestionnaire des risques ou le demandeur ; validation métier inchangée', () => {
    const d = { statut: 'DEMANDEE' as const, demandeurId: 'u2', avisRssiPar: null }
    expect(canAvisRssiDerogation(rm, d)).toBe(false)
    expect(canAvisRssiDerogation(rm, d, PS)).toBe(true)
    expect(canDoubleRegardDerogation(rm, { ...d, statut: 'DOUBLE_REGARD' as const, avisRssiPar: 'u2' }, PS)).toBe(true)
    expect(canValiderDerogation(rm, { ...d, statut: 'VALIDATION_METIER' as const })).toBe(false)
    expect(canAvisRssiDerogation({ id: 'a1', role: 'ADMIN' }, d, PS)).toBe(true)
    expect(canAvisRssiDerogation({ id: 'a1', role: 'ADMIN' }, d)).toBe(false)
  })
  it('relances : l’auteur unique est relancé pour sa propre analyse, le gestionnaire pour l’avis RSSI', () => {
    const membres = [{ userId: 'u1', role: 'RSSI' }, { userId: 'u3', role: 'RISK_MANAGER' }]
    expect(approbateursAnalyse(membres, { auteurId: 'u1', projet360: false, rolesDejaApprouves: [], acces: [] }, PS)).toEqual(['u1', 'u3'])
    expect(approbateursAnalyse(membres, { auteurId: 'u1', projet360: false, rolesDejaApprouves: [], acces: [] })).toEqual(['u3'])
    expect(valideursDerogation([{ userId: 'u3', role: 'RISK_MANAGER' }], { statut: 'DEMANDEE', demandeurId: 'u3', avisRssiPar: null }, PS)).toEqual(['u3'])
    expect(valideursDerogation([{ userId: 'a1', role: 'ADMIN' }], { statut: 'DEMANDEE', demandeurId: 'a1', avisRssiPar: null }, PS)).toEqual(['a1'])
  })
})
