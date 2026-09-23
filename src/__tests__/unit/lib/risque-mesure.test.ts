// Mesure de sécurité rattachée à un risque (saisie directe) — module pur.
import { describe, it, expect } from 'vitest'
import { sanitizeRiskMesure, isRiskMesureValid } from '@/lib/risque-mesure'

describe('sanitizeRiskMesure', () => {
  it('normalise type (défaut PREVENTIVE) et statut (défaut RÉALISÉ = contrôle existant)', () => {
    const p = sanitizeRiskMesure({ nom: 'MFA', type: 'ZZZ' })
    expect(p.type).toBe('PREVENTIVE')
    expect(p.statut).toBe('REALISE')
    const ok = sanitizeRiskMesure({ nom: 'Journalisation', type: 'DETECTIVE', statut: 'EN_COURS' })
    expect(ok.type).toBe('DETECTIVE'); expect(ok.statut).toBe('EN_COURS')
  })

  it('borne l’efficacité à [1,4] et tronque le nom ; omet efficacité si absente', () => {
    expect(sanitizeRiskMesure({ nom: 'x', efficacite: 9 }).efficacite).toBe(4)
    expect(sanitizeRiskMesure({ nom: 'x' })).not.toHaveProperty('efficacite')
    expect(sanitizeRiskMesure({ nom: 'a'.repeat(300) }).nom.length).toBe(255)
  })

  it('un intitulé est requis', () => {
    expect(isRiskMesureValid(sanitizeRiskMesure({ nom: '  ' }))).toBe(false)
    expect(isRiskMesureValid(sanitizeRiskMesure({ nom: 'Sauvegardes' }))).toBe(true)
  })
})
