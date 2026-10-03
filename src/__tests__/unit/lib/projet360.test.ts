import { describe, expect, it } from 'vitest'
import {
  DOMAINES_360, QUESTIONS_360, RISK_RULES_360, isDomaine360, progression360, suggested360Risks, domainStats360,
  applyApprobation, APPROBATION_ROLES_REQUIS, planCyberImport, defaultAnswers360, domaineFromTaxonomie, planPopulation360, sanitizeSources360,
} from '@/lib/projet360'
import { METHOD_META, methodSteps, usesDirectRiskEntry, IMPLEMENTED_METHODS } from '@/lib/methodes'
import { QUALIFICATION_RISK_CATEGORIES } from '@/lib/qualification'

describe('méthode PROJET_360', () => {
  it('méthode à saisie directe, câblée, fondée sur ISO 31000:2018, 5 phases', () => {
    expect(IMPLEMENTED_METHODS).toContain('PROJET_360')
    expect(usesDirectRiskEntry('PROJET_360')).toBe(true)
    expect(METHOD_META.PROJET_360.standard).toContain('ISO 31000:2018')
    expect(methodSteps('PROJET_360').map(s => [s.key, s.type])).toEqual([
      ['contexte', 'context'], ['qualification', 'qualification'], ['appreciation', 'appreciation'], ['evaluation', 'review'], ['traitement', 'appreciation'],
    ])
  })
})

describe('domaines et questionnaire 360', () => {
  it('six domaines, tous catégories de risques de qualification', () => {
    expect(DOMAINES_360).toEqual(['CYBER', 'IT', 'PROJECT', 'BUSINESS', 'FRAUD', 'OUTSOURCING'])
    for (const d of DOMAINES_360) expect(QUALIFICATION_RISK_CATEGORIES).toContain(d)
    expect(isDomaine360('FRAUD')).toBe(true)
    expect(isDomaine360('AUTRE')).toBe(false)
  })

  it('au moins trois questions par domaine, identifiants préfixés p360.', () => {
    for (const d of DOMAINES_360) expect(QUESTIONS_360.filter(q => q.domaine === d).length).toBeGreaterThanOrEqual(3)
    for (const q of QUESTIONS_360) expect(q.id.startsWith('p360.')).toBe(true)
    expect(new Set(QUESTIONS_360.map(q => q.id)).size).toBe(QUESTIONS_360.length)
  })

  it('chaque règle cible une question existante, limitée à PROJET_360, domaine = catégorie', () => {
    const ids = new Set(QUESTIONS_360.map(q => q.id))
    for (const r of RISK_RULES_360) {
      expect(ids.has(r.when.questionId)).toBe(true)
      expect(r.methods).toEqual(['PROJET_360'])
      expect(QUESTIONS_360.find(q => q.id === r.when.questionId)!.domaine).toBe(r.risk.category)
      expect(r.risk.titleKey).toMatch(/^p360_/)
    }
  })

  it('propositions déclenchées par les réponses, y compris une réponse « non » à risque', () => {
    const risks = suggested360Risks({ 'p360.cyber.exposeInternet': true, 'p360.fraude.separationTaches': false, 'p360.it.obsolescence': false })
    const cats = risks.map(r => r.category)
    expect(cats).toContain('CYBER')
    expect(cats).toContain('FRAUD')
    expect(cats).not.toContain('IT')
  })

  it('progression par domaine', () => {
    const p = progression360({ 'p360.cyber.exposeInternet': true, 'p360.cyber.donneesSensibles': false })
    expect(p.CYBER).toEqual({ answered: 2, total: QUESTIONS_360.filter(q => q.domaine === 'CYBER').length })
    expect(p.FRAUD.answered).toBe(0)
  })
})

describe('domainStats360', () => {
  it('agrège par domaine : nombre, max/moyenne brut et résiduel, au-dessus de l’appétit, traités, top 3', () => {
    const s = domainStats360([
      { id: 'r1', nom: 'A', domaine: 'CYBER', niveauRisque: 12, niveauResiduel: 6 },
      { id: 'r2', nom: 'B', domaine: 'CYBER', niveauRisque: 16, niveauResiduel: null },
      { id: 'r3', nom: 'C', domaine: 'FRAUD', niveauRisque: 4, niveauResiduel: 4 },
      { id: 'r4', nom: 'D', domaine: null, niveauRisque: 9, niveauResiduel: null },
    ], 8)
    const cyber = s.domains.find(d => d.domaine === 'CYBER')!
    expect(cyber).toMatchObject({ count: 2, maxBrut: 16, avgBrut: 14, maxResiduel: 16, aboveAppetite: 1, treated: 1 })
    expect(cyber.top.map(r => r.id)).toEqual(['r2', 'r1'])
    expect(s.domains.find(d => d.domaine === 'IT')!.count).toBe(0)
    expect(s.unclassified).toBe(1)
    expect(s.total).toBe(4)
  })
})

describe('double approbation RSSI + Risk Manager', () => {
  const now = new Date('2026-09-29T10:00:00Z')
  it('exige un RSSI ET un RISK_MANAGER distincts', () => {
    expect(APPROBATION_ROLES_REQUIS).toEqual(['RSSI', 'RISK_MANAGER'])
    const a = applyApprobation([], { userId: 'rssi1', role: 'RSSI', commentaire: 'ok' }, now)
    expect(a).toMatchObject({ ok: true, complete: false })
    const b = applyApprobation(a.ok ? a.approbations : [], { userId: 'rm1', role: 'RISK_MANAGER' }, now)
    expect(b).toMatchObject({ ok: true, complete: true })
    if (b.ok) expect(b.approbations.map(x => x.role)).toEqual(['RSSI', 'RISK_MANAGER'])
  })

  it('refuse un second avis du même rôle ou de la même personne, et un rôle non approbateur', () => {
    const first = [{ role: 'RSSI' as const, userId: 'u1', le: now.toISOString() }]
    expect(applyApprobation(first, { userId: 'u2', role: 'RSSI' }, now)).toEqual({ ok: false, error: 'ROLE_DEJA_APPROUVE' })
    expect(applyApprobation(first, { userId: 'u1', role: 'RISK_MANAGER' }, now)).toEqual({ ok: false, error: 'MEME_PERSONNE' })
    expect(applyApprobation([], { userId: 'u3', role: 'ANALYSTE' }, now)).toEqual({ ok: false, error: 'ROLE_NON_APPROBATEUR' })
  })

  it('ADMIN : dérogation historique, complète l’approbation (tracée)', () => {
    const r = applyApprobation([{ role: 'RSSI', userId: 'u1', le: now.toISOString() }], { userId: 'adm', role: 'ADMIN' }, now)
    expect(r).toMatchObject({ ok: true, complete: true })
    if (r.ok) expect(r.approbations[1]).toMatchObject({ role: 'ADMIN', userId: 'adm' })
  })
})

describe('planCyberImport', () => {
  const src = [
    { id: 's1', nom: 'Rançongiciel', description: 'd', gravite: 4, vraisemblance: 3, graviteActuelle: 3, vraisemblanceActuelle: 3, graviteResiduelle: 2, vraisemblanceResiduelle: 2, strategie: 'REDUIRE', proprietaire: 'DSI', taxonomieCode: 'T1' },
    { id: 's2', nom: 'Fuite', description: null, gravite: 3, vraisemblance: 2, graviteActuelle: null, vraisemblanceActuelle: null, graviteResiduelle: null, vraisemblanceResiduelle: null, strategie: 'ACCEPTER', proprietaire: null, taxonomieCode: null },
    { id: 's3', nom: 'Déjà importé', description: null, gravite: 2, vraisemblance: 2, graviteActuelle: null, vraisemblanceActuelle: null, graviteResiduelle: null, vraisemblanceResiduelle: null, strategie: 'REDUIRE', proprietaire: null, taxonomieCode: null },
  ]
  it('copie la sélection en domaine CYBER, tracée, sans doublon, niveaux repris ou chaînés', () => {
    const rows = planCyberImport({ sourceAnalyseId: 'A0', source: src, selectedIds: ['s1', 's2', 's3', 'inconnu'], alreadyImported: ['s3'], maxNiveau: 4 })
    expect(rows.map(r => r.sourceRisqueId)).toEqual(['s1', 's2'])
    expect(rows[0]).toMatchObject({ domaine: 'CYBER', sourceAnalyseId: 'A0', nom: 'Rançongiciel', niveauRisque: 12, niveauActuel: 9, niveauResiduel: 4, proprietaire: 'DSI', taxonomieCode: 'T1' })
    // Sans cotation actuelle/résiduelle : défauts chaînés sur le brut.
    expect(rows[1]).toMatchObject({ niveauRisque: 6, niveauActuel: 6, niveauResiduel: 6, strategie: 'ACCEPTER' })
  })

  it('borne les cotations à l’échelle de l’organisation', () => {
    const rows = planCyberImport({ sourceAnalyseId: 'A0', source: [{ ...src[0], gravite: 5 }], selectedIds: ['s1'], alreadyImported: [], maxNiveau: 4 })
    expect(rows[0].gravite).toBe(4)
  })
})

describe('pré-remplissage à partir des données existantes', () => {
  it('ne répond « oui » que sur preuve, avec la source ; ne devine jamais « non »', () => {
    const { answers, sources } = defaultAnswers360({
      analysesCyber: 2, ticCritiques: 1, ticCloud: 0, processusCritiques: 3, traitementsRgpd: 5, doraActif: true,
    })
    expect(answers).toEqual({
      'p360.cyber.analyseCyber': true,
      'p360.ext.prestataireCritique': true,
      'p360.metier.processusCritique': true,
      'p360.cyber.donneesSensibles': true,
      'p360.metier.exigenceReglementaire': true,
      'p360.fraude.fluxFinanciers': true,
    })
    expect(sources['p360.ext.prestataireCritique']).toBe('tic')
    expect(answers['p360.ext.cloud']).toBeUndefined()
    expect(defaultAnswers360({ analysesCyber: 0, ticCritiques: 0, ticCloud: 0, processusCritiques: 0, traitementsRgpd: 0, doraActif: false }).answers).toEqual({})
  })

  it('domaine d’un risque du registre d’après la taxonomie de Bâle', () => {
    expect(domaineFromTaxonomie('BALE_1')).toBe('FRAUD')
    expect(domaineFromTaxonomie('BALE_2_3')).toBe('FRAUD')
    expect(domaineFromTaxonomie('BALE_6')).toBe('IT')
    expect(domaineFromTaxonomie('BALE_7_1')).toBe('BUSINESS')
    expect(domaineFromTaxonomie(null)).toBeNull()
    expect(domaineFromTaxonomie('PERSO_X')).toBeNull()
  })

  it('plan de population : risques proposés sans doublon (règle déjà créée ou intitulé existant)', () => {
    const answers = { 'p360.cyber.exposeInternet': true, 'p360.cyber.analyseCyber': false, 'p360.ext.cloud': true }
    const plan = planPopulation360({
      answers, orgRules: [], catalog: { p360_compromissionExpose: { title: 'Compromission d’un service exposé' }, p360_cyberNonApprecie: { title: 'Risques cyber non appréciés' }, p360_maitriseDonneesCloud: { title: 'Perte de maîtrise des données hébergées' } },
      existingRuleIds: ['p360-cyberNonApprecie'], existingTitles: ['perte de maîtrise des données hébergées'],
    })
    expect(plan.map(p => [p.id, p.category])).toEqual([['p360-compromissionExpose', 'CYBER']])
  })
})

describe('sanitizeSources360', () => {
  it('ne garde que les questions et sources connues', () => {
    expect(sanitizeSources360({ 'p360._sources': { 'p360.ext.cloud': 'cloud', 'p360.x': 'cloud', 'p360.cyber.analyseCyber': 'pirate' } })).toEqual({ 'p360.ext.cloud': 'cloud' })
    expect(sanitizeSources360(null)).toEqual({})
  })
})

import { prefillFromPatterns, mergePrefill } from '@/lib/projet360'
describe('questionnaire 360 pré-rempli par les patterns d’architecture (lot A5, BE-6)', () => {
  const F = { analysesCyber: 0, ticCritiques: 0, ticCloud: 0, processusCritiques: 0, traitementsRgpd: 0, doraActif: false }
  it('EXPOSITION_INTERNET → « exposition à Internet : oui » ; INTERCO / EXTERNALISATION / TELEMAINTENANCE → prestataire ; SaaS / IaaS → cloud ; SI sensible → données sensibles', () => {
    expect(prefillFromPatterns(['EXPOSITION_INTERNET']).answers).toEqual({ 'p360.cyber.exposeInternet': true })
    for (const p of ['INTERCO_TIERS', 'EXTERNALISATION_DONNEES', 'TELEMAINTENANCE']) expect(prefillFromPatterns([p]).answers).toEqual({ 'p360.ext.prestataireCritique': true })
    for (const p of ['CLOUD_SAAS', 'CLOUD_IAAS_PAAS']) expect(prefillFromPatterns([p]).answers).toEqual({ 'p360.ext.cloud': true })
    expect(prefillFromPatterns(['SI_SENSIBLE']).answers).toEqual({ 'p360.cyber.donneesSensibles': true })
    expect(prefillFromPatterns(['SI_PATRIMONIAL']).answers).toEqual({ 'p360.it.obsolescence': true })
  })
  it('chaque réponse porte sa source « patterns » ; un pattern sans lien avec le questionnaire ne pré-remplit rien ; codes inconnus ignorés', () => {
    expect(prefillFromPatterns(['EXPOSITION_INTERNET']).sources).toEqual({ 'p360.cyber.exposeInternet': 'patterns' })
    expect(prefillFromPatterns(['DMZ', 'BUREAUTIQUE', 'PIRATE']).answers).toEqual({})
  })
  it('jamais de « non » deviné : seules des réponses « oui »', () => {
    const all = prefillFromPatterns(['EXPOSITION_INTERNET', 'INTERCO_TIERS', 'CLOUD_SAAS', 'SI_SENSIBLE', 'SI_PATRIMONIAL']).answers
    expect(Object.values(all).every(v => v === true)).toBe(true)
  })
  it('fusion sans écrasement : une réponse déjà donnée (oui OU non) est conservée', () => {
    const base = { 'p360.cyber.exposeInternet': false, 'p360.ext.cloud': true }
    const m = mergePrefill(base, prefillFromPatterns(['EXPOSITION_INTERNET', 'CLOUD_SAAS', 'INTERCO_TIERS']))
    expect(m.answers['p360.cyber.exposeInternet']).toBe(false)           // « non » conservé
    expect(m.answers['p360.ext.cloud']).toBe(true)
    expect(m.answers['p360.ext.prestataireCritique']).toBe(true)         // non répondu : pré-rempli
    expect(m.sources).toEqual({ 'p360.ext.prestataireCritique': 'patterns' }) // seule la réponse ajoutée porte une source
  })
  it('defaultAnswers360 : les faits de l’organisation et les patterns se complètent ; la source des faits prime', () => {
    const r = defaultAnswers360({ ...F, ticCloud: 2, patterns: ['CLOUD_SAAS', 'EXPOSITION_INTERNET'] })
    expect(r.sources['p360.ext.cloud']).toBe('cloud')
    expect(r.answers['p360.cyber.exposeInternet']).toBe(true); expect(r.sources['p360.cyber.exposeInternet']).toBe('patterns')
    expect(defaultAnswers360({ ...F }).answers).toEqual({})
  })
})
