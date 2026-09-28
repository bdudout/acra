import { describe, expect, it } from 'vitest'
import {
  DEFAULT_QUALIFICATION_RISK_RULES, QUALIFICATION_RISK_CATALOG_KEYS,
  sanitizeQualificationConfig, suggestedQualificationRisks, type QualificationRiskRule,
} from '@/lib/qualification'
import {
  localizeQualificationRisks, planQualificationRiskCreation, pendingQualificationRisks, qualificationRiskChannel,
} from '@/lib/qualification-risks'

const rule = (over: Partial<QualificationRiskRule> = {}): QualificationRiskRule => ({
  id: 'r1', when: { questionId: 'donneesPersonnelles', equals: true },
  risk: { category: 'CYBER', title: 'Fuite', gravity: 4, likelihood: 2, strategy: 'REDUIRE' }, ...over,
})

describe('catalogue par défaut', () => {
  it('chaque règle par défaut est traduite (titleKey du catalogue) et sans libellé codé en dur', () => {
    expect(DEFAULT_QUALIFICATION_RISK_RULES.length).toBeGreaterThanOrEqual(5)
    for (const r of DEFAULT_QUALIFICATION_RISK_RULES) {
      expect(QUALIFICATION_RISK_CATALOG_KEYS).toContain(r.risk.titleKey)
      expect(r.risk.title).toBe('')
    }
  })

  it('survit à un aller-retour par le sanitizer (sauvegarde admin)', () => {
    const out = sanitizeQualificationConfig({ overrides: {}, custom: [], riskRules: DEFAULT_QUALIFICATION_RISK_RULES })
    expect(out.riskRules).toEqual(DEFAULT_QUALIFICATION_RISK_RULES.map(r => ({ ...r, enabled: true, mandatory: false })))
  })
})

describe('sanitizeQualificationConfig — règles de risques', () => {
  it('conserve le mode imposé', () => {
    const out = sanitizeQualificationConfig({ riskRules: [rule({ mandatory: true })] })
    expect(out.riskRules?.[0].mandatory).toBe(true)
  })

  it('refuse une règle sans intitulé ni clé de catalogue connue', () => {
    const noTitle = rule({ risk: { category: 'CYBER', title: '', gravity: 2, likelihood: 2, strategy: 'REDUIRE' } })
    const badKey = rule({ risk: { category: 'CYBER', title: '', titleKey: 'inconnu', gravity: 2, likelihood: 2, strategy: 'REDUIRE' } })
    expect(sanitizeQualificationConfig({ riskRules: [noTitle, badKey] }).riskRules).toEqual([])
  })
})

describe('suggestedQualificationRisks', () => {
  it('expose le caractère imposé et la clé de catalogue', () => {
    const [p] = suggestedQualificationRisks({ donneesPersonnelles: true }, [rule({ mandatory: true })])
    expect(p).toMatchObject({ id: 'r1', mandatory: true })
  })
})

describe('localizeQualificationRisks', () => {
  const catalog = { personalData: { title: 'Personal data breach', description: 'Disclosure…' } }
  it('résout les règles par défaut via le catalogue traduit et garde les intitulés personnalisés', () => {
    const out = localizeQualificationRisks([
      { id: 'a', category: 'CYBER', title: '', titleKey: 'personalData', gravity: 4, likelihood: 2, strategy: 'REDUIRE', mandatory: false },
      { id: 'b', category: 'FRAUD', title: 'Fraude au président', gravity: 3, likelihood: 2, strategy: 'REDUIRE', mandatory: true },
    ], catalog)
    expect(out.map(r => [r.title, r.description])).toEqual([['Personal data breach', 'Disclosure…'], ['Fraude au président', undefined]])
  })
})

describe('planQualificationRiskCreation', () => {
  const proposals = [
    { id: 'a', mandatory: false }, { id: 'b', mandatory: true }, { id: 'c', mandatory: false }, { id: 'd', mandatory: false },
  ]
  it('crée la sélection + les risques imposés, jamais deux fois une même règle', () => {
    const plan = planQualificationRiskCreation({ proposals, selectedIds: ['a', 'zz'], existingRuleIds: ['d'] })
    expect(plan.toCreate.map(p => p.id)).toEqual(['a', 'b'])
    expect(plan.skipped).toEqual([{ id: 'c', reason: 'NOT_SELECTED' }, { id: 'd', reason: 'ALREADY_CREATED' }])
  })

  it('un risque imposé déjà créé n’est pas recréé', () => {
    const plan = planQualificationRiskCreation({ proposals, selectedIds: [], existingRuleIds: ['b'] })
    expect(plan.toCreate).toEqual([])
  })

  it('pendingQualificationRisks ne garde que les règles pas encore créées', () => {
    expect(pendingQualificationRisks(proposals, ['a', 'b']).map(p => p.id)).toEqual(['c', 'd'])
  })
})

describe('qualificationRiskChannel', () => {
  it('EBIOS RM propose en atelier 5, les méthodes directes au registre', () => {
    expect(qualificationRiskChannel('EBIOS_RM')).toBe('ATELIER5')
    expect(qualificationRiskChannel('ISO_27005')).toBe('DIRECT')
    expect(qualificationRiskChannel('ISO_31000')).toBe('DIRECT')
    expect(qualificationRiskChannel(null)).toBe('ATELIER5') // défaut = EBIOS RM
  })
})

import { qualificationRiskToAtelier5Risk, dedupeQualificationRuleIds } from '@/lib/qualification-risks'

describe('qualificationRiskToAtelier5Risk (EBIOS RM, atelier 5)', () => {
  it('produit un risque d’atelier 5 rattaché à sa règle, cotation reprise, résiduel = brut', () => {
    const proposal = { id: 'fraude', title: 'Fraude', description: 'D', category: 'FRAUD', gravity: 3, likelihood: 2, strategy: 'TRANSFERER', mandatory: true }
    const r = qualificationRiskToAtelier5Risk(proposal, 'uid-1')
    expect(r).toMatchObject({
      id: 'uid-1', nom: 'Fraude', description: 'D', qualificationRuleId: 'fraude', scenarioOpId: '',
      gravite: 3, vraisemblance: 2, niveauRisque: 6, strategie: 'TRANSFERER',
      graviteResiduelle: 3, vraisemblanceResiduelle: 2, niveauResiduel: 6,
    })
  })
})

describe('dedupeQualificationRuleIds (sauvegarde atelier 5)', () => {
  it('garde la règle d’origine sur la 1ʳᵉ occurrence seulement (contrainte unique analyse × règle)', () => {
    const out = dedupeQualificationRuleIds([{ nom: 'a', qualificationRuleId: 'x' }, { nom: 'b', qualificationRuleId: 'x' }, { nom: 'c' }, { nom: 'd', qualificationRuleId: '  ' }])
    expect(out.map(r => r.qualificationRuleId ?? null)).toEqual(['x', null, null, null])
  })
})
