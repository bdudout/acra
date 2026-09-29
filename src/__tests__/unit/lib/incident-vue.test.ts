import { describe, expect, it } from 'vitest'
import { vueIncidentL1, colonnesLdcL1, enTetesLdcL1 } from '@/lib/incident-vue'
import { resolveIncidentsConfig } from '@/lib/incidents-config'

const now = new Date('2026-10-02T12:00:00Z')
const cfg = resolveIncidentsConfig({ seuilCollecte: 100, seuilGrandePerte: 5000, taux: { USD: 0.5 }, regimes: [{ code: 'NIS2', actif: true }, { code: 'RGPD_33', actif: true }] })
const row = {
  dateDetection: new Date('2026-09-29T08:00:00Z'), createdAt: new Date('2026-09-30T08:00:00Z'), quasiIncident: false,
  attributs: { significatif: true, donneesPersonnelles: true }, notifications: [{ regime: 'NIS2', phase: 'ALERTE_PRECOCE', soumisLe: '2026-09-29T20:00:00.000Z' }],
  pertes: [{ type: 'PERTE_DIRECTE', montant: 6000, devise: 'EUR', statut: 'ESTIME' }, { type: 'PENALITE', montant: 2000, devise: 'USD', statut: 'ESTIME' }],
  recuperationsLignes: [{ type: 'ASSURANCE', montant: 1000, devise: 'EUR' }],
}

describe('vueIncidentL1', () => {
  const v = vueIncidentL1(row, cfg, now)
  it('horloges par régime applicable, échéances depuis la détection, retards comptés', () => {
    expect(v.horloges.map(h => h.regime)).toEqual(['NIS2', 'RGPD_33'])
    expect(v.horloges[0].phases[0].statut).toBe('SOUMIS')
    expect(v.horloges[0].phases[1].statut).toBe('EN_RETARD') // 72 h dépassées le 02/10 08:00
    expect(v.nbEnRetard).toBe(2) // notification NIS2 + notification RGPD
  })
  it('totaux convertis, seuils et ventilation par type', () => {
    expect(v.totaux).toMatchObject({ brut: 7000, recuperations: 1000, net: 6000 })
    expect(v.seuils).toEqual({ collectee: true, grandePerte: true })
    expect(v.parType).toEqual({ PERTE_DIRECTE: 6000, PENALITE: 1000 })
  })
  it('à défaut de détection, la date de déclaration fait office de connaissance', () => {
    const w = vueIncidentL1({ ...row, dateDetection: null, notifications: [] }, cfg, now)
    expect(w.horloges[0].phases[0].echeance?.toISOString()).toBe('2026-10-01T08:00:00.000Z')
  })
})

describe('export LDC — colonnes L1', () => {
  it('en-têtes : type, quasi-incident, règlement, devise, puis une colonne par type de perte actif', () => {
    const h = enTetesLdcL1(cfg)
    expect(h.slice(0, 4)).toEqual(['typeEvenement', 'quasiIncident', 'dateReglement', 'devise'])
    expect(h).toContain('perte_PENALITE')
    expect(h.filter(x => x.startsWith('perte_'))).toHaveLength(cfg.typesPerte.filter(x => x.actif).length)
  })
  it('valeurs : ventilation convertie par type, quasi-incident indiqué, colonnes vides sans lignes', () => {
    const c = colonnesLdcL1({ ...row, typeEvenement: 'CYBER', dateReglement: new Date('2026-10-05T00:00:00Z') }, cfg)
    expect(c).toMatchObject({ typeEvenement: 'CYBER', quasiIncident: 'non', dateReglement: '2026-10-05', devise: 'EUR', perte_PERTE_DIRECTE: 6000, perte_PENALITE: 1000 })
    const q = colonnesLdcL1({ ...row, quasiIncident: true, typeEvenement: null, dateReglement: null }, cfg)
    expect(q.quasiIncident).toBe('oui')
    expect(q.perte_PENALITE).toBe('')
  })
})
