/** Rapports R-INC-1 (tableau de bord incidents) et R-PER-2 (pertes) : construction pure. */
import { describe, expect, it } from 'vitest'
import { buildRapportIncidents, buildRapportPertes, type IncidentRapportRow } from '@/lib/rapport-incidents'
import { vueIncidentL1 } from '@/lib/incident-vue'
import { resolveIncidentsConfig } from '@/lib/incidents-config'
import type { Bloc } from '@/lib/rapport-model'

const now = new Date('2026-10-02T12:00:00Z')
const cfg = resolveIncidentsConfig({ deviseReference: 'EUR', taux: { USD: 0.5 }, seuilCollecte: 100, seuilGrandePerte: 5000, regimes: [{ code: 'NIS2', actif: true }] })
const periode = { debut: '2026-09-01', fin: '2026-09-30' }
const labels = { statut: (c: string) => `S:${c}`, typeEvenement: (c: string) => `T:${c}`, typePerte: (c: string) => `P:${c}`, taxo: (c: string | null) => (c ? `C:${c}` : '—') }

function row(o: Partial<IncidentRapportRow> & { id: string }, extra: Record<string, unknown> = {}): IncidentRapportRow {
  const base = {
    intitule: `Incident ${o.id}`, statut: 'QUALIFIE', typeEvenement: 'CYBER', taxonomieCode: 'BALE_6', entite: 'Siège',
    dateSurvenance: new Date('2026-09-10T00:00:00Z'), dateDetection: new Date('2026-09-12T00:00:00Z'), createdAt: new Date('2026-09-12T08:00:00Z'), clotureLe: null,
    quasiIncident: false, attributs: {}, notifications: [], pertes: [], recuperationsLignes: [], ...extra,
  }
  const r = { ...base, ...o }
  return { ...r, l1: vueIncidentL1(r as never, cfg, now) } as IncidentRapportRow
}
const rows: IncidentRapportRow[] = [
  row({ id: 'a' }, { attributs: { significatif: true }, pertes: [{ type: 'PERTE_DIRECTE', montant: 6000, devise: 'EUR', statut: 'ESTIME' }, { type: 'PENALITE', montant: 400, devise: 'USD', statut: 'ESTIME' }], recuperationsLignes: [{ type: 'ASSURANCE', montant: 1000, devise: 'EUR' }] }),
  row({ id: 'b', statut: 'CLOTURE', typeEvenement: 'FRAUDE', taxonomieCode: 'BALE_1', entite: 'Filiale', dateSurvenance: new Date('2026-09-20T00:00:00Z'), dateDetection: new Date('2026-09-21T00:00:00Z'), clotureLe: new Date('2026-09-25T00:00:00Z') }, { pertes: [{ type: 'PERTE_DIRECTE', montant: 50, devise: 'EUR', statut: 'ESTIME' }] }),
  row({ id: 'c', quasiIncident: true, typeEvenement: 'CYBER' }),
  row({ id: 'hors', dateSurvenance: new Date('2026-07-01T00:00:00Z'), createdAt: new Date('2026-07-02T00:00:00Z') }),
]
const kpis = (s: { blocs: Bloc[] }) => (s.blocs.find(b => b.type === 'kpis') as Extract<Bloc, { type: 'kpis' }>).items
const tableau = (r: { sections: { id: string; blocs: Bloc[] }[] }, id: string) => r.sections.find(s => s.id === id)!.blocs.find(b => b.type === 'tableau') as Extract<Bloc, { type: 'tableau' }>

describe('R-INC-1 — tableau de bord incidents', () => {
  const r = buildRapportIncidents(rows, cfg, periode, now, labels)
  it('ne retient que les incidents de la période ; synthèse chiffrée', () => {
    const k = Object.fromEntries(kpis(r.sections.find(s => s.id === 'synthese')!).map(x => [x.cle, x.valeur]))
    expect(k.total).toBe(3)
    expect(k.quasi).toBe(1)
    expect(k.clotures).toBe(1)
    expect(k.ouverts).toBe(2)
    expect(k.delaiDetectionJours).toBe(1.7) // (2 + 1 + 2) / 3 = 1,666… → 1,7
    expect(k.notifsEnRetard).toBeGreaterThan(0)
  })
  it('ventilations par statut, par type et par mois', () => {
    expect(tableau(r, 'parStatut').lignes).toEqual([['S:QUALIFIE', 2], ['S:CLOTURE', 1]])
    expect(tableau(r, 'parType').lignes).toEqual([['T:CYBER', 2], ['T:FRAUDE', 1]])
    expect(tableau(r, 'parMois').lignes).toEqual([['2026-09', 3, 1]])
  })
  it('liste les notifications en retard avec la clé du régime (résolue à l’affichage)', () => {
    const t = tableau(r, 'notifsEnRetard')
    expect(t.lignes.length).toBeGreaterThan(0)
    expect(t.lignes[0][1]).toEqual({ k: 'notifRegimes.NIS2.label' })
  })
  it('code, période, devise et date de génération portés par l’édition', () => {
    expect([r.code, r.periode, r.deviseReference, r.genereLe]).toEqual(['R-INC-1', periode, 'EUR', now.toISOString()])
  })
})

describe('R-PER-2 — pertes', () => {
  const r = buildRapportPertes(rows, cfg, periode, now, labels)
  it('totaux convertis, collecte et grandes pertes (quasi-incidents exclus)', () => {
    const k = Object.fromEntries(kpis(r.sections.find(s => s.id === 'synthese')!).map(x => [x.cle, x.valeur]))
    expect(k.brut).toBe(6250) // 6000 + 400×0,5 + 50
    expect(k.recuperations).toBe(1000)
    expect(k.net).toBe(5250)
    expect(k.grandesPertes).toBe(1)
    expect(k.sousSeuil).toBe(1) // « b » : 50 € < seuil de collecte 100 €
  })
  it('ventilation par type de perte, par catégorie et par entité', () => {
    expect(tableau(r, 'parTypePerte').lignes).toEqual([['P:PERTE_DIRECTE', 6050], ['P:PENALITE', 200]])
    expect(tableau(r, 'parCategorie').lignes[0]).toEqual(['C:BALE_6', 1, 5200])
    expect(tableau(r, 'parEntite').lignes.map(l => l[0])).toEqual(['Siège', 'Filiale'])
  })
  it('grandes pertes listées, période exclue ignorée', () => {
    const t = tableau(r, 'grandesPertes')
    expect(t.lignes).toHaveLength(1)
    expect(t.lignes[0][0]).toBe('Incident a')
  })
  it('signale les devises sans taux dans les avertissements', () => {
    const sansTaux = buildRapportPertes([row({ id: 'z' }, { pertes: [{ type: 'AUTRE', montant: 10, devise: 'CHF', statut: 'ESTIME' }] })], cfg, periode, now, labels)
    const avert = sansTaux.sections.find(s => s.id === 'avertissements')
    expect(avert).toBeTruthy()
  })
})
