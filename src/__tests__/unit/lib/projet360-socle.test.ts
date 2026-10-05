/** Risques présents par défaut dans tout projet 360 (configurables par l'organisation). */
import { describe, expect, it } from 'vitest'
import { RISQUES_PROJET_SOCLE, sanitizeSocleConfig, risquesSocle, planSocle, SOCLE_RULE_PREFIX } from '@/lib/projet360-socle'
import { DOMAINES_360 } from '@/lib/projet360'

describe('catalogue des risques projet par défaut', () => {
  it('couvre gestion de projet, RGPD, externalisation, sécurité, mise en service ; codes uniques ; textes ×5', () => {
    const codes = RISQUES_PROJET_SOCLE.map(r => r.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes).toEqual(expect.arrayContaining(['PROJ_DELAIS', 'PROJ_BUDGET', 'PROJ_RGPD', 'PROJ_PRESTATAIRE', 'PROJ_SECURITE']))
    for (const r of RISQUES_PROJET_SOCLE) {
      expect(DOMAINES_360).toContain(r.domaine)
      expect(r.intitule.every(s => s.trim().length > 0)).toBe(true)
      expect(r.intitule[1]).not.toBe(r.intitule[0])
    }
    expect(RISQUES_PROJET_SOCLE.length).toBeLessThanOrEqual(10) // l'essentiel, sans surcharger
  })
})

describe('configuration de l’organisation', () => {
  it('assainit : codes désactivés connus seulement, risques ajoutés bornés (intitulé, domaine, cotation), 30 au plus', () => {
    const c = sanitizeSocleConfig({
      desactives: ['PROJ_BUDGET', 'INCONNU', 'PROJ_BUDGET'],
      ajoutes: [
        { id: 'a1', intitule: '  Indisponibilité du site pilote ', domaine: 'BUSINESS', gravite: 9, vraisemblance: 0 },
        { id: 'a2', intitule: '', domaine: 'IT', gravite: 2, vraisemblance: 2 },
        { intitule: 'Sans identifiant', domaine: 'X', gravite: 2, vraisemblance: 2 },
        ...Array.from({ length: 40 }, (_, i) => ({ id: `x${i}`, intitule: `R${i}`, gravite: 2, vraisemblance: 2 })),
      ],
    })
    expect(c.desactives).toEqual(['PROJ_BUDGET'])
    expect(c.ajoutes[0]).toEqual({ id: 'a1', intitule: 'Indisponibilité du site pilote', domaine: 'BUSINESS', gravite: 5, vraisemblance: 1 })
    expect(c.ajoutes.find(a => a.intitule === 'Sans identifiant')).toMatchObject({ domaine: null })
    expect(c.ajoutes.every(a => a.id && a.intitule)).toBe(true)
    expect(c.ajoutes.length).toBeLessThanOrEqual(30)
    expect(sanitizeSocleConfig(null)).toEqual({ desactives: [], ajoutes: [] })
  })
})

describe('risques créés avec le projet', () => {
  const cfg = sanitizeSocleConfig({ desactives: ['PROJ_BUDGET'], ajoutes: [{ id: 'a1', intitule: 'Indisponibilité du site pilote', domaine: 'BUSINESS', gravite: 5, vraisemblance: 2 }] })
  it('catalogue moins les désactivés, plus les ajoutés ; libellés dans la langue ; cotation bornée à l’échelle', () => {
    const r = risquesSocle(cfg, 'en', 4)
    expect(r.some(x => x.ruleId === `${SOCLE_RULE_PREFIX}PROJ_BUDGET`)).toBe(false)
    expect(r.find(x => x.ruleId === `${SOCLE_RULE_PREFIX}PROJ_DELAIS`)!.nom).toMatch(/schedule|milestone/i)
    expect(r.find(x => x.ruleId === `${SOCLE_RULE_PREFIX}custom:a1`)).toMatchObject({ nom: 'Indisponibilité du site pilote', domaine: 'BUSINESS', gravite: 4 })
  })
  it('sans doublon : règle déjà présente ou intitulé déjà saisi', () => {
    const r = risquesSocle(cfg, 'fr', 4)
    const plan = planSocle(r, [`${SOCLE_RULE_PREFIX}PROJ_DELAIS`], [r.find(x => x.ruleId.endsWith('PROJ_RGPD'))!.nom.toUpperCase()])
    expect(plan.some(x => x.ruleId.endsWith('PROJ_DELAIS'))).toBe(false)
    expect(plan.some(x => x.ruleId.endsWith('PROJ_RGPD'))).toBe(false)
    expect(plan.length).toBe(r.length - 2)
  })
})
