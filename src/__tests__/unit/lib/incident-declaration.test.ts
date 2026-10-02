import { describe, expect, it } from 'vitest'
import { buildDoraReportJson, buildNotificationJson, cleanDeclaration, CRITERIA_OPTIONS, DORA_ITS_FIELDS, DORA_STAGES, doraFieldRows, fieldsOfStage, isMandatoryAt, itsDatetime, itsDuration, type DeclarationIncident } from '@/lib/incident-declaration'

const incident: DeclarationIncident = {
  id: 'inc123', intitule: 'Panne du SI de paiement', description: 'Indisponibilité du moteur de paiement',
  dateSurvenance: new Date('2026-10-05T06:30:00Z'), dateDetection: new Date('2026-10-05T07:00:00Z'), doraClasseMajeurLe: new Date('2026-10-05T09:00:00Z'),
  doraCriteres: { clientsAffectes: 5000, dureeIndispoMinutes: 200, serviceCritique: true, reputation: true },
  montantBrut: 12_500_500, recuperations: 2_000_000, clotureLe: new Date('2026-10-07T10:00:00Z'), clotureCommentaire: 'Correctif déployé',
  causeRacine: 'SYSTEMES', causeDetail: 'Défaut de configuration après mise à jour',
  typeEvenement: 'CYBER', statut: 'CLOTURE',
}
const ctx = { organisationNom: 'Banque Exemple', devise: 'EUR', now: new Date('2026-10-08T00:00:00Z') }

describe('champs ITS 2025/302 (annexe II — glossaire de données)', () => {
  it('numérotation et noms officiels : 15 champs généraux, 10 initiaux, 35 intermédiaires, 16 finaux ; types et listes de valeurs admises', () => {
    const count = (s: string) => DORA_ITS_FIELDS.filter(f => f.stage === s).length
    expect([count('GENERAL'), count('INITIAL'), count('INTERMEDIATE'), count('FINAL')]).toEqual([15, 10, 35, 16])
    const field = (id: string) => DORA_ITS_FIELDS.find(f => f.id === id)!
    expect(field('2.5').name).toBe('Classification criteria that triggered the incident report')
    expect(field('2.5').options).toEqual(CRITERIA_OPTIONS); expect(CRITERIA_OPTIONS).toHaveLength(7)
    expect(field('3.23').options).toEqual(['Cybersecurity-related', 'Process failure', 'System failure', 'External event', 'Payment-related', 'Other (please specify)'])
    expect(field('3.25').options).toHaveLength(10); expect(field('2.7').options).toContain('monitoring systems')
    expect(field('4.1').options).toEqual(['malicious actions', 'process failure', 'system failure/malfunction', 'human error', 'external event'])
    expect(Object.keys(field('4.2').groups!)).toEqual(field('4.1').options); expect(field('4.2').groups!['human error']).toContain('mistake')
    expect(field('1.4').options).toContain('insurance and reinsurance undertaking'); expect(field('1.4').options).toContain('credit institution')
    expect(field('3.15').kind).toBe('duration'); expect(field('3.13').kind).toBe('multi'); expect(field('4.13').kind).toBe('amount')
    expect(new Set(DORA_ITS_FIELDS.map(f => f.id)).size).toBe(DORA_ITS_FIELDS.length)
    expect(DORA_STAGES).toEqual(['INITIAL', 'INTERMEDIATE', 'FINAL'])
  })
  it('caractère obligatoire : 1.x et 2.x partout ; 3.x dès l’intermédiaire ; 4.x au final ; conditionnels jamais exigés d’office', () => {
    const f = (id: string) => DORA_ITS_FIELDS.find(x => x.id === id)!
    expect(isMandatoryAt(f('2.7'), 'INITIAL')).toBe(true); expect(isMandatoryAt(f('3.4'), 'INITIAL')).toBe(false); expect(isMandatoryAt(f('3.4'), 'INTERMEDIATE')).toBe(true)
    expect(isMandatoryAt(f('4.6'), 'INTERMEDIATE')).toBe(false); expect(isMandatoryAt(f('4.6'), 'FINAL')).toBe(true)
    expect(isMandatoryAt(f('2.8'), 'FINAL')).toBe(false); expect(f('2.8').condition).toMatch(/third-party/)
    expect(fieldsOfStage('INITIAL').map(x => x.id).some(id => id.startsWith('3.'))).toBe(false)
    expect(fieldsOfStage('INTERMEDIATE').map(x => x.id)).toContain('2.1'); expect(fieldsOfStage('FINAL').map(x => x.id)).toContain('3.35')
  })
  it('formats : date-heure UTC ISO 8601 sans millisecondes, durée JJ:HH:MM', () => {
    expect(itsDatetime(new Date('2026-10-05T07:00:00.123Z'))).toBe('2026-10-05T07:00:00Z'); expect(itsDatetime('pas une date')).toBeNull()
    expect(itsDuration(200)).toBe('00:03:20'); expect(itsDuration(1440 + 125)).toBe('01:02:05'); expect(itsDuration(-5)).toBe('00:00:00')
  })
})

describe('buildDoraReportJson', () => {
  it('rapport initial : champs généraux et initiaux déduits de l’incident, valeurs officielles, non renseigné = absent (jamais inventé)', () => {
    const r = buildDoraReportJson(incident, 'INITIAL', {}, ctx)
    expect(r.submissionType).toBe('initial_notification')
    expect(r.fields['1.1']).toBe('initial notification'); expect(r.fields['1.5']).toBe('Banque Exemple'); expect(r.fields['1.15']).toBe('EUR')
    expect(r.fields['2.1']).toBe('ACRA-inc123')
    expect(r.fields['2.2']).toBe('2026-10-05T07:00:00Z'); expect(r.fields['2.3']).toBe('2026-10-05T09:00:00Z')
    expect(r.fields['2.4']).toContain('Panne du SI de paiement')
    expect(r.fields['2.5']).toEqual(['clients, financial counterparts and transactions affected', 'duration and service downtime', 'reputational impact', 'critical services affected'])
    expect(r.fields['2.8']).toBeUndefined(); expect(r.fields['1.6']).toBeUndefined(); expect(r.fields['3.4']).toBeUndefined()
    // obligatoires manquants (glossaire) vs conditionnels à examiner
    expect(r.missing).toEqual(expect.arrayContaining(['1.3', '1.4', '1.7', '1.8', '1.9', '2.7', '2.9'])); expect(r.missing).not.toContain('2.8')
    expect(r.toCheck).toEqual(expect.arrayContaining(['1.6', '2.8', '2.10']))
  })
  it('rapport intermédiaire : reprend les champs 1 et 2 ; ajoute 3.x (survenance, clients, durée) ; saisie prioritaire ; 3.23 proposé par l’incident type', () => {
    const r = buildDoraReportJson({ ...incident, catalogueKey: 'cyber.ddos' }, 'INTERMEDIATE', { '3.4': '4800', '3.31': ['CSIRT', 'Inconnue'] }, ctx)
    expect(r.submissionType).toBe('intermediate_report'); expect(r.fields['1.1']).toBe('intermediate report')
    expect(r.fields['2.1']).toBe('ACRA-inc123'); expect(r.fields['3.2']).toBe('2026-10-05T06:30:00Z')
    expect(r.fields['3.4']).toBe(4800); expect(r.fields['3.31']).toEqual(['CSIRT']) // valeur hors liste ignorée
    expect(r.fields['3.16']).toBe('00:03:20'); expect(r.fields['3.23']).toEqual(['Cybersecurity-related']); expect(r.fields['3.25']).toEqual(['(D)DoS'])
    expect(r.fields['3.13']).toBeUndefined(); expect(r.fields['3.22']).toBeUndefined() // pas de déduction hasardeuse
    expect(r.missing).toEqual(expect.arrayContaining(['3.5', '3.6', '3.12', '3.22', '3.27', '3.28', '3.30', '3.33']))
    expect(r.fields['4.13']).toBeUndefined() // champ d'une étape suivante
  })
  it('rapport final : cumule 1 à 4 ; montants en MILLIERS d’unités ; cause, résolution, clôture ; durée 3.15 depuis survenance et clôture', () => {
    const r = buildDoraReportJson(incident, 'FINAL', {}, ctx)
    expect(r.submissionType).toBe('final_report'); expect(r.fields['1.1']).toBe('final report')
    expect(r.fields['4.13']).toBe(12_500.5); expect(r.fields['4.14']).toBe(2_000)
    expect(r.fields['4.5']).toBe('Défaut de configuration après mise à jour'); expect(r.fields['4.6']).toBe('Correctif déployé'); expect(r.fields['4.8']).toBe('2026-10-07T10:00:00Z')
    expect(r.fields['3.15']).toBe('02:03:30'); expect(r.fields['2.1']).toBe('ACRA-inc123')
    expect(r.fields['4.1']).toBeUndefined(); expect(r.hints.rootCause).toBe('SYSTEMES'); expect(r.missing).toEqual(expect.arrayContaining(['4.1', '4.2', '4.7', '4.12']))
  })
  it('contient les références réglementaires et la mise en garde (canal, schéma et format fixés par l’autorité nationale ; ACPR / OneGate)', () => {
    const r = buildDoraReportJson(incident, 'INITIAL', {}, ctx)
    expect(r.schema).toBe('acra.dora-incident-report/1'); expect(r.source).toContain('2025/302'); expect(r.source).toContain('2025/301')
    expect(r.notice).toMatch(/ACPR/); expect(r.notice).toMatch(/OneGate/)
  })
})

describe('doraFieldRows — tableau d’une étape (export Excel)', () => {
  it('une ligne par champ cumulé, avec type, caractère obligatoire, valeur, statut et valeurs admises', () => {
    const rows = doraFieldRows(incident, 'INITIAL', {}, ctx)
    expect(rows).toHaveLength(15 + 10)
    const r25 = rows.find(r => r.id === '2.5')!
    expect(r25).toMatchObject({ mandatory: 'all', status: 'FILLED' }); expect(r25.allowed).toHaveLength(7)
    expect(rows.find(r => r.id === '2.7')).toMatchObject({ status: 'MISSING', mandatory: 'all' })
    expect(rows.find(r => r.id === '2.8')).toMatchObject({ status: 'TO_CHECK', mandatory: 'conditional' })
    expect(rows.find(r => r.id === '2.8')!.condition).toBeTruthy()
  })
})

describe('cleanDeclaration — compléments saisis, contrôlés selon le glossaire', () => {
  it('ne garde que les champs ITS éditables ; types et listes de valeurs respectés', () => {
    const c = cleanDeclaration({ '1.3': '549300abcdefghij1234', '1.6': 'trop court', '2.8': 'Prestataire;LEI123;LEI;', '3.4': '1200', '3.5': '2,44', '3.15': '01:02:30', '3.16': '99:99', '2.6': 'fr, de , xx1', '2.7': 'staff', '2.9': 'true', '9.9': 'x', '2.2': 'écrasement interdit', '2.1': 'x', '4.2': ['mistake', 'inconnu'], '3.3': '2026-10-05 07:00' })
    expect(c['1.3']).toBe('549300ABCDEFGHIJ1234'); expect(c['1.6']).toBeUndefined()
    expect(c['2.8']).toBe('Prestataire;LEI123;LEI;'); expect(c['3.4']).toBe(1200); expect(c['3.5']).toBe(2.4)
    expect(c['3.15']).toBe('01:02:30'); expect(c['3.16']).toBeUndefined(); expect(c['2.6']).toEqual(['FR', 'DE'])
    expect(c['2.7']).toBe('staff'); expect(c['2.9']).toBe(true); expect(c['9.9']).toBeUndefined(); expect(c['2.2']).toBeUndefined(); expect(c['2.1']).toBeUndefined()
    expect(c['4.2']).toEqual(['mistake']); expect(c['3.3']).toBe('2026-10-05T07:00:00Z')
    expect(cleanDeclaration({ '2.7': 'valeur libre' })['2.7']).toBeUndefined()
    expect(cleanDeclaration({ '2.4': 'x'.repeat(5000) })['2.4']).toHaveLength(2000)
    expect(cleanDeclaration(null)).toEqual({}); expect(cleanDeclaration([1])).toEqual({})
  })
})

describe('buildNotificationJson — autres régimes (NIS2, CRA, RGPD, SEC…)', () => {
  it('structure commune : régime, autorité, phase, échéance, faits de l’incident, état de la déclaration', () => {
    const j = buildNotificationJson(incident, { code: 'CRA_14', label: 'CRA', autorite: 'CSIRT', phase: { code: 'ALERTE_PRECOCE', label: 'Early warning' }, echeance: new Date('2026-10-06T07:00:00Z'), soumisLe: null }, ctx)
    expect(j.schema).toBe('acra.incident-notification/1')
    expect(j.regime).toMatchObject({ code: 'CRA_14', phase: 'ALERTE_PRECOCE', deadline: '2026-10-06T07:00:00.000Z', submittedAt: null })
    expect(j.incident).toMatchObject({ reference: 'ACRA-inc123', title: 'Panne du SI de paiement', detectedAt: '2026-10-05T07:00:00.000Z', occurredAt: '2026-10-05T06:30:00.000Z', organisation: 'Banque Exemple' })
    expect(j.notice).toBeTruthy()
  })
})

import { RGPD_FIELDS, cleanRgpd } from '@/lib/incident-declaration'

describe('notification RGPD art. 33 § 3 (CNIL)', () => {
  it('rubriques : nature, personnes (catégories, nombre), données (catégories, nombre), DPO, conséquences, mesures, motif du retard', () => {
    expect(RGPD_FIELDS.map(f => f.id)).toEqual(['rgpd.nature', 'rgpd.categoriesPersonnes', 'rgpd.nbPersonnes', 'rgpd.categoriesDonnees', 'rgpd.nbEnregistrements', 'rgpd.dpo', 'rgpd.consequences', 'rgpd.mesures', 'rgpd.retardMotif'])
    expect(RGPD_FIELDS.find(f => f.id === 'rgpd.nbPersonnes')!.kind).toBe('integer')
  })
  it('nettoyage : champs inconnus écartés, entiers positifs, textes bornés', () => {
    expect(cleanRgpd({ 'rgpd.nature': '  Exfiltration  ', 'rgpd.nbPersonnes': '1200.7', 'rgpd.nbEnregistrements': -4, 'rgpd.inconnu': 'x', 'rgpd.dpo': 'a'.repeat(5000) })).toEqual({ 'rgpd.nature': 'Exfiltration', 'rgpd.nbPersonnes': 1200, 'rgpd.dpo': 'a'.repeat(2000) })
  })
  it('cleanDeclaration conserve les rubriques RGPD en plus des champs ITS ; le JSON du régime RGPD_33 les reprend dans un bloc « rgpd » (autres régimes : aucun bloc)', () => {
    const decl = cleanDeclaration({ 'rgpd.nature': 'Envoi à un mauvais destinataire', 'rgpd.nbPersonnes': 40, '2.1': 'x' })
    expect(decl['rgpd.nature']).toBe('Envoi à un mauvais destinataire'); expect(decl['rgpd.nbPersonnes']).toBe(40)
    const n = { code: 'RGPD_33', phase: { code: 'NOTIFICATION' }, echeance: null, soumisLe: null }
    const json = buildNotificationJson(incident, n, ctx, decl)
    expect(json.rgpd).toMatchObject({ nature: 'Envoi à un mauvais destinataire', nbPersonnes: 40 })
    expect(buildNotificationJson(incident, { ...n, code: 'NIS2' }, ctx, decl).rgpd).toBeUndefined()
    expect(buildNotificationJson(incident, n, ctx).rgpd).toBeDefined() // bloc présent, rubriques à compléter (nature proposée depuis la description)
    expect(buildNotificationJson(incident, n, ctx).rgpd!.nature).toBe('Indisponibilité du moteur de paiement')
  })
})
