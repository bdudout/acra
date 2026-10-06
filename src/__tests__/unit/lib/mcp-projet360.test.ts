// MCP — démo projet 360 : proposition de risque enrichie (domaine, cotations brut / actuel / résiduel cohérentes,
// échelle de l'organisation, mesures et plans) et proposition de création d'un projet 360.
import { describe, expect, it } from 'vitest'
import { riskProposalToCreate, sanitizeRiskProposal } from '@/lib/mcp/proposals'
import { isProjet360ProposalValid, sanitizeProjet360Proposal } from '@/lib/mcp/projet360-proposal'

describe('sanitizeRiskProposal — enrichi', () => {
  it('domaine 360 conservé s’il est connu, ignoré sinon', () => {
    expect(sanitizeRiskProposal({ nom: 'x', domaine: 'FRAUD' }).domaine).toBe('FRAUD')
    expect(sanitizeRiskProposal({ nom: 'x', domaine: 'MARKETING' }).domaine).toBeUndefined()
  })
  it('cotations cohérentes : actuel ≤ brut, résiduel ≤ actuel (gravité et vraisemblance séparément)', () => {
    const p = sanitizeRiskProposal({ nom: 'x', gravite: 3, vraisemblance: 2, graviteActuelle: 4, vraisemblanceActuelle: 2, graviteResiduelle: 4, vraisemblanceResiduelle: 1 })
    expect(p).toMatchObject({ gravite: 3, vraisemblance: 2, graviteActuelle: 3, vraisemblanceActuelle: 2, graviteResiduelle: 3, vraisemblanceResiduelle: 1, niveauRisque: 6, niveauActuel: 6, niveauResiduel: 3 })
  })
  it('échelle de l’organisation : 5 niveaux acceptés si l’échelle en a 5, ramenés à 4 sinon', () => {
    expect(sanitizeRiskProposal({ nom: 'x', gravite: 5, vraisemblance: 5 }, 5)).toMatchObject({ gravite: 5, vraisemblance: 5, niveauRisque: 25 })
    expect(sanitizeRiskProposal({ nom: 'x', gravite: 5, vraisemblance: 5 })).toMatchObject({ gravite: 4, vraisemblance: 4 })
  })
  it('mesures et plans : nettoyés, bornés à 10, sans entrée vide ; échéance au format date', () => {
    const p = sanitizeRiskProposal({
      nom: 'x',
      mesures: [{ nom: 'MFA', type: 'TECHNIQUE' }, { nom: '' }, { nom: 'Chiffrement', type: 'INVENTE' }, ...Array.from({ length: 12 }, (_, i) => ({ nom: `m${i}` }))],
      plans: [{ titre: 'Choisir un hébergeur HDS', porteur: 'DSI', echeance: '2027-01-15', priorite: 'CRITIQUE' }, { titre: 'x', echeance: 'demain', priorite: 'ULTRA' }],
    })
    expect(p.mesures).toHaveLength(10)
    expect(p.mesures?.[0]).toEqual({ nom: 'MFA', type: 'TECHNIQUE' })
    expect(p.mesures?.[1]).toEqual({ nom: 'Chiffrement', type: 'PREVENTIVE' })
    expect(p.plans).toEqual([{ titre: 'Choisir un hébergeur HDS', porteur: 'DSI', echeance: '2027-01-15', priorite: 'CRITIQUE' }, { titre: 'x', echeance: null, priorite: 'MAJEUR' }])
  })
  it('création : toutes les cotations et le domaine', () => {
    const data = riskProposalToCreate(sanitizeRiskProposal({ nom: 'Fuite', gravite: 4, vraisemblance: 3, graviteResiduelle: 2, vraisemblanceResiduelle: 2, domaine: 'CYBER' }), 'an1')
    expect(data).toMatchObject({ analyseId: 'an1', nom: 'Fuite', domaine: 'CYBER', niveauRisque: 12, graviteActuelle: 4, vraisemblanceActuelle: 3, niveauActuel: 12, graviteResiduelle: 2, vraisemblanceResiduelle: 2, niveauResiduel: 4 })
    expect(data).not.toHaveProperty('mesures')
    expect(data).not.toHaveProperty('plans')
  })
})

describe('proposition de projet 360', () => {
  const base = { nom: 'Espace adhérent 2027', objectifs: 'Souscription en ligne', description: 'Portail et application', secteur: 'Santé / Médico-social', sousSecteurs: ['sante-amc', 'banque-detail', 'sante-portail'], patternsArchi: ['EXPOSITION_INTERNET', 'IA_SERVICES', 'INCONNU'], miseEnService: '2027-03-01' }
  it('nettoyée : sous-secteurs cohérents avec le secteur, patterns connus, date valide', () => {
    const p = sanitizeProjet360Proposal(base, { patternsMax: 12 })
    expect(p).toMatchObject({ nom: 'Espace adhérent 2027', secteur: 'Santé / Médico-social', sousSecteurs: ['sante-amc', 'sante-portail'], patternsArchi: ['EXPOSITION_INTERNET', 'IA_SERVICES'], miseEnService: '2027-03-01' })
    expect(isProjet360ProposalValid(p)).toBe(true)
  })
  it('invalide sans nom, sans secteur ou sans pattern ; date invalide ignorée', () => {
    expect(isProjet360ProposalValid(sanitizeProjet360Proposal({ ...base, nom: ' ' }, { patternsMax: 12 }))).toBe(false)
    expect(isProjet360ProposalValid(sanitizeProjet360Proposal({ ...base, secteur: '' }, { patternsMax: 12 }))).toBe(false)
    expect(isProjet360ProposalValid(sanitizeProjet360Proposal({ ...base, patternsArchi: [] }, { patternsMax: 12 }))).toBe(false)
    expect(sanitizeProjet360Proposal({ ...base, miseEnService: '01/03/2027' }, { patternsMax: 12 }).miseEnService).toBeNull()
  })
  it('patterns plafonnés au maximum de l’organisation', () => {
    expect(sanitizeProjet360Proposal({ ...base, patternsArchi: ['EXPOSITION_INTERNET', 'IA_SERVICES', 'CLOUD_SAAS'] }, { patternsMax: 2 }).patternsArchi).toHaveLength(2)
  })
})
