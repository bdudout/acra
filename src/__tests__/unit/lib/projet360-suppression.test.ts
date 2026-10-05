import { describe, expect, it } from 'vitest'
import { validateurSuppression, peutValiderSuppression, decisionSuppression } from '@/lib/projet360-suppression'

describe('suppression d’un risque de projet soumise à validation', () => {
  it('validateur : le RSSI pour un risque cyber, le gestionnaire des risques sinon', () => {
    expect(validateurSuppression('CYBER')).toBe('RSSI')
    expect(validateurSuppression('PROJECT')).toBe('RISK_MANAGER')
    expect(validateurSuppression(null)).toBe('RISK_MANAGER')
  })
  it('qui peut valider : le validateur attendu ou un administrateur ; en petite structure, RSSI et RM se suppléent', () => {
    expect(peutValiderSuppression('RSSI', 'CYBER')).toBe(true)
    expect(peutValiderSuppression('RISK_MANAGER', 'CYBER')).toBe(false)
    expect(peutValiderSuppression('RISK_MANAGER', 'BUSINESS')).toBe(true)
    expect(peutValiderSuppression('RSSI', 'BUSINESS')).toBe(false)
    expect(peutValiderSuppression('ADMIN', 'CYBER')).toBe(true)
    expect(peutValiderSuppression('ANALYSTE', 'IT')).toBe(false)
    expect(peutValiderSuppression('RISK_MANAGER', 'CYBER', { petiteStructure: true })).toBe(true)
  })
  it('décision : suppression directe hors projet 360, sans validation configurée, ou par un validateur ; sinon demande', () => {
    expect(decisionSuppression({ methode: 'ISO_31000', validationActive: true, role: 'ANALYSTE', domaine: 'CYBER' })).toBe('SUPPRIMER')
    expect(decisionSuppression({ methode: 'PROJET_360', validationActive: false, role: 'ANALYSTE', domaine: 'CYBER' })).toBe('SUPPRIMER')
    expect(decisionSuppression({ methode: 'PROJET_360', validationActive: true, role: 'RSSI', domaine: 'CYBER' })).toBe('SUPPRIMER')
    expect(decisionSuppression({ methode: 'PROJET_360', validationActive: true, role: 'ANALYSTE', domaine: 'CYBER' })).toBe('DEMANDER')
  })
})
