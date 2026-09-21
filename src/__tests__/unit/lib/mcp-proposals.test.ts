// Logique pure des propositions MCP : assainissement d'une proposition de risque,
// recalcul autoritaire du niveau, mapping vers la création Prisma.
import { describe, it, expect } from 'vitest'
import { sanitizeRiskProposal, isRiskProposalValid, riskProposalToCreate } from '@/lib/mcp/proposals'

describe('sanitizeRiskProposal', () => {
  it('clampe gravité/vraisemblance et RECALCULE niveauRisque (jamais la valeur fournie)', () => {
    const p = sanitizeRiskProposal({ nom: 'Rançongiciel', gravite: 4, vraisemblance: 3, niveauRisque: 1 /* menti */ })
    expect(p.gravite).toBe(4)
    expect(p.vraisemblance).toBe(3)
    expect(p.niveauRisque).toBe(12) // 4×3, pas la valeur fournie (1)
  })

  it('normalise une stratégie inconnue vers REDUIRE', () => {
    expect(sanitizeRiskProposal({ nom: 'x', strategie: 'HACK' }).strategie).toBe('REDUIRE')
    expect(sanitizeRiskProposal({ nom: 'x', strategie: 'TRANSFERER' }).strategie).toBe('TRANSFERER')
  })

  it('tronque le nom et la description, ignore les champs hors schéma', () => {
    const p = sanitizeRiskProposal({ nom: 'a'.repeat(500), description: 'd'.repeat(5000), evil: 'DROP TABLE' })
    expect(p.nom.length).toBe(255)
    expect((p.description as string).length).toBe(2000)
    expect(p as unknown as Record<string, unknown>).not.toHaveProperty('evil')
  })

  it('entrée non-objet → proposition avec nom vide (invalide)', () => {
    const p = sanitizeRiskProposal(null)
    expect(p.nom).toBe('')
    expect(isRiskProposalValid(p)).toBe(false)
  })
})

describe('isRiskProposalValid', () => {
  it('exige un nom non vide', () => {
    expect(isRiskProposalValid(sanitizeRiskProposal({ nom: '   ' }))).toBe(false)
    expect(isRiskProposalValid(sanitizeRiskProposal({ nom: 'OK' }))).toBe(true)
  })
})

describe('riskProposalToCreate', () => {
  it('mappe vers les données Prisma Risque avec l\'analyseId cible', () => {
    const payload = sanitizeRiskProposal({ nom: 'Fuite', gravite: 3, vraisemblance: 2, strategie: 'REDUIRE', description: 'd', niveauResiduel: 2 })
    const data = riskProposalToCreate(payload, 'an1')
    expect(data).toEqual({
      analyseId: 'an1', nom: 'Fuite', gravite: 3, vraisemblance: 2, niveauRisque: 6,
      strategie: 'REDUIRE', description: 'd', niveauResiduel: 2,
    })
  })

  it('omet les champs optionnels absents', () => {
    const data = riskProposalToCreate(sanitizeRiskProposal({ nom: 'Min' }), 'an2')
    expect(data).not.toHaveProperty('description')
    expect(data).not.toHaveProperty('niveauResiduel')
  })
})
