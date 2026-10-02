import { describe, expect, it } from 'vitest'
import { buildDoraReportJson, buildNotificationJson, cleanDeclaration, DORA_ITS_FIELDS, DORA_STAGES, type DeclarationIncident } from '@/lib/incident-declaration'

const incident: DeclarationIncident = {
  id: 'inc123', intitule: 'Panne du SI de paiement', description: 'Indisponibilité du moteur de paiement',
  dateSurvenance: new Date('2026-10-05T06:30:00Z'), dateDetection: new Date('2026-10-05T07:00:00Z'), doraClasseMajeurLe: new Date('2026-10-05T09:00:00Z'),
  doraCriteres: { clientsAffectes: 5000, dureeIndispoMinutes: 200, serviceCritique: true, reputation: true },
  montantBrut: 12_500_500, recuperations: 2_000_000, clotureLe: new Date('2026-10-07T10:00:00Z'), clotureCommentaire: 'Correctif déployé',
  causeRacine: 'SYSTEMES', causeDetail: 'Défaut de configuration après mise à jour',
  typeEvenement: 'CYBER', statut: 'CLOTURE',
}
const ctx = { organisationNom: 'Banque Exemple', devise: 'EUR', now: new Date('2026-10-08T00:00:00Z') }

describe('champs ITS 2025/302 (annexe I)', () => {
  it('numérotation et noms officiels : 15 champs généraux, 10 initiaux, 35 intermédiaires, 16 finaux', () => {
    const count = (s: string) => DORA_ITS_FIELDS.filter(f => f.stage === s).length
    expect([count('GENERAL'), count('INITIAL'), count('INTERMEDIATE'), count('FINAL')]).toEqual([15, 10, 35, 16])
    expect(DORA_ITS_FIELDS.find(f => f.id === '2.5')!.name).toBe('Classification criteria that triggered the incident report')
    expect(DORA_ITS_FIELDS.find(f => f.id === '4.13')!.name).toBe('Amount of gross direct and indirect costs and losses')
    expect(new Set(DORA_ITS_FIELDS.map(f => f.id)).size).toBe(DORA_ITS_FIELDS.length)
    expect(DORA_STAGES).toEqual(['INITIAL', 'INTERMEDIATE', 'FINAL'])
  })
})

describe('buildDoraReportJson', () => {
  it('rapport initial : champs généraux et initiaux déduits de l’incident, identification stable, non renseigné = absent (jamais inventé)', () => {
    const r = buildDoraReportJson(incident, 'INITIAL', {}, ctx)
    expect(r.submissionType).toBe('initial_notification')
    expect(r.fields['1.1']).toBe('Initial notification'); expect(r.fields['1.5']).toBe('Banque Exemple'); expect(r.fields['1.15']).toBe('EUR')
    expect(r.fields['2.1']).toBe('ACRA-inc123')
    expect(r.fields['2.2']).toBe('2026-10-05T07:00:00.000Z'); expect(r.fields['2.3']).toBe('2026-10-05T09:00:00.000Z')
    expect(r.fields['2.4']).toContain('Panne du SI de paiement')
    expect(r.fields['2.5']).toEqual(['clients_counterparts_transactions', 'duration_service_downtime', 'reputational_impact', 'critical_services_affected'])
    expect(r.fields['2.8']).toBeUndefined(); expect(r.fields['1.6']).toBeUndefined()
    expect(r.fields['3.4']).toBeUndefined() // champ d'une autre étape
    expect(r.missing).toEqual(expect.arrayContaining(['1.6', '1.7', '2.7', '2.8', '2.9']))
  })
  it('rapport intermédiaire : survenance, clients, durée, réputation, données ; contribution manuelle prioritaire sur la déduction', () => {
    const r = buildDoraReportJson(incident, 'INTERMEDIATE', { '3.23': 'Process failure', '3.4': '4800' }, ctx)
    expect(r.submissionType).toBe('intermediate_report')
    expect(r.fields['3.2']).toBe('2026-10-05T06:30:00.000Z')
    expect(r.fields['3.4']).toBe(4800) // saisie manuelle numérique, prioritaire
    expect(r.fields['3.13']).toBe(true)
    expect(r.fields['3.15']).toEqual({ days: 0, hours: 3, minutes: 20 })
    expect(r.fields['3.23']).toBe('Process failure')
    expect(r.missing).toContain('3.25')
  })
  it('rapport final : montants en MILLIERS d’unités (instruction des AES), cause, résolution, clôture', () => {
    const r = buildDoraReportJson(incident, 'FINAL', {}, ctx)
    expect(r.submissionType).toBe('final_report')
    expect(r.fields['4.13']).toBe(12_500.5) // 12 500 500 € → 12 500,5 milliers
    expect(r.fields['4.14']).toBe(2_000)
    expect(r.fields['4.5']).toBe('Défaut de configuration après mise à jour')
    expect(r.fields['4.6']).toBe('Correctif déployé'); expect(r.fields['4.8']).toBe('2026-10-07T10:00:00.000Z')
    expect(r.fields['4.1']).toBeUndefined() // choix à faire par l'entité (liste ITS) — l'indice ACRA est fourni à part
    expect(r.hints.rootCause).toBe('SYSTEMES')
  })
  it('contient la référence réglementaire et la mise en garde (le canal de dépôt est fixé par l’autorité nationale)', () => {
    const r = buildDoraReportJson(incident, 'INITIAL', {}, ctx)
    expect(r.schema).toBe('acra.dora-incident-report/1'); expect(r.source).toContain('2025/302')
    expect(r.notice).toMatch(/autorité compétente|competent authority/i)
  })
})

describe('cleanDeclaration — compléments saisis', () => {
  it('ne garde que les champs manuels connus, valeurs bornées ; nombres reconnus pour les champs numériques', () => {
    const c = cleanDeclaration({ '1.6': '549300ABCDEFGHIJ1234', '2.8': 'Prestataire;LEI123;LEI;', '3.4': '1200', '9.9': 'x', '2.2': 'écrasement interdit', '2.1': 'x' })
    expect(c['1.6']).toBe('549300ABCDEFGHIJ1234'); expect(c['3.4']).toBe(1200); expect(c['9.9']).toBeUndefined()
    expect(c['2.2']).toBeUndefined() // champ dérivé de l'incident : non éditable ici
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
