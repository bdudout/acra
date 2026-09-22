// Logique pure des propositions MCP : assainissement d'une proposition de risque,
// recalcul autoritaire du niveau, mapping vers la création Prisma.
import { describe, it, expect } from 'vitest'
import {
  sanitizeRiskProposal, isRiskProposalValid, riskProposalToCreate,
  sanitizeMeasureProposal, isMeasureProposalValid, measureProposalToCreate,
  sanitizePlanActionProposal, isPlanActionProposalValid, planActionProposalToCreate,
  sanitizeConformiteProposal, isConformiteProposalValid,
} from '@/lib/mcp/proposals'

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

describe('sanitizeMeasureProposal', () => {
  it('normalise type/statut vers leurs enums (défauts PREVENTIVE / A_FAIRE)', () => {
    const p = sanitizeMeasureProposal({ nom: 'MFA', type: 'MAGIQUE', statut: 'INVALIDE' })
    expect(p.type).toBe('PREVENTIVE')
    expect(p.statut).toBe('A_FAIRE')
    const ok = sanitizeMeasureProposal({ nom: 'MFA', type: 'TECHNIQUE', statut: 'EN_COURS' })
    expect(ok.type).toBe('TECHNIQUE')
    expect(ok.statut).toBe('EN_COURS')
  })

  it('sérialise l\'échéance en ISO et clampe la priorité', () => {
    const p = sanitizeMeasureProposal({ nom: 'x', echeance: '2027-01-15', priorite: 9, efficacite: 7 })
    expect(p.echeance).toBe(new Date('2027-01-15').toISOString())
    expect(p.priorite).toBe(4) // clampé à [1,4]
    expect(p.efficacite).toBe(4) // clampé à [1,4]
  })

  it('échéance invalide → absente ; nom requis pour la validité', () => {
    const p = sanitizeMeasureProposal({ nom: 'x', echeance: 'pas-une-date' })
    expect(p).not.toHaveProperty('echeance')
    expect(isMeasureProposalValid(sanitizeMeasureProposal({ nom: '  ' }))).toBe(false)
  })
})

describe('measureProposalToCreate', () => {
  it('mappe vers Prisma Mesure (échéance → Date) avec l\'analyseId', () => {
    const payload = sanitizeMeasureProposal({ nom: 'Sauvegardes', type: 'CORRECTIVE', priorite: 1, statut: 'EN_COURS', echeance: '2027-03-01', responsable: 'DSI' })
    const data = measureProposalToCreate(payload, 'an9')
    expect(data).toMatchObject({ analyseId: 'an9', nom: 'Sauvegardes', type: 'CORRECTIVE', priorite: 1, statut: 'EN_COURS', responsable: 'DSI' })
    expect(data.echeance).toBeInstanceOf(Date)
  })
})

describe('sanitizePlanActionProposal', () => {
  it('exige un titre ; tronque et normalise', () => {
    expect(isPlanActionProposalValid(sanitizePlanActionProposal({}))).toBe(false)
    const p = sanitizePlanActionProposal({ titre: 'a'.repeat(300), priorite: 'CRITIQUE', statut: 'ZZZ' })
    expect(p.titre.length).toBe(200)
    expect(p.priorite).toBe('CRITIQUE')
    expect(p.statut).toBe('A_FAIRE') // statut inconnu → défaut
    expect(isPlanActionProposalValid(p)).toBe(true)
  })
})

describe('planActionProposalToCreate', () => {
  it('mappe vers PlanAction + lien polymorphe vers l\'ancre', () => {
    const payload = sanitizePlanActionProposal({ titre: 'Durcir le VPN', porteur: 'DSI', echeance: '2027-06-01' })
    const data = planActionProposalToCreate(payload, 'orgA', 'RISQUE', 'ri1', 'u1')
    expect(data).toMatchObject({ organizationId: 'orgA', titre: 'Durcir le VPN', porteur: 'DSI', createdById: 'u1' })
    expect(data.echeance).toBeInstanceOf(Date)
    expect(data.liens).toEqual({ create: [{ type: 'RISQUE', targetId: 'ri1' }] })
  })
})

describe('sanitizeConformiteProposal / isConformiteProposalValid', () => {
  it('borne ref/commentaire et valide le statut', () => {
    const p = sanitizeConformiteProposal({ ref: '  A.5.1  ', statut: 'non_conforme', commentaire: '  MFA absente  ' })
    expect(p).toEqual({ ref: 'A.5.1', statut: 'non_conforme', commentaire: 'MFA absente' })
    expect(isConformiteProposalValid(p)).toBe(true)
  })

  it('statut inconnu → invalide (pas de défaut trompeur)', () => {
    const p = sanitizeConformiteProposal({ ref: 'A.5.1', statut: 'PEUT_ETRE' })
    expect(p.statut).toBe('')
    expect(isConformiteProposalValid(p)).toBe(false)
  })

  it('ref vide → invalide', () => {
    expect(isConformiteProposalValid(sanitizeConformiteProposal({ ref: '   ', statut: 'conforme' }))).toBe(false)
  })

  it('accepte tous les statuts connus', () => {
    for (const s of ['conforme', 'partiel', 'non_conforme', 'na']) {
      expect(isConformiteProposalValid(sanitizeConformiteProposal({ ref: 'X', statut: s }))).toBe(true)
    }
  })
})
