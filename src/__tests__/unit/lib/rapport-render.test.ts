import { describe, expect, it } from 'vitest'
import { resoudreCellule, contenuVersFeuilles, titreSection, libelleKpi, libelleColonne, formaterKpi } from '@/lib/rapport-render'
import type { RapportContenu } from '@/lib/rapport-model'
import { fr } from '@/lib/i18n/fr'

const tr = (k: string) => k.split('.').reduce<unknown>((o, x) => (o as Record<string, unknown>)?.[x], fr) as string | undefined

const contenu: RapportContenu = {
  code: 'R-INC-1', periode: { debut: '2026-09-01', fin: '2026-09-30' }, genereLe: '2026-10-02T12:00:00.000Z', deviseReference: 'EUR',
  sections: [
    { id: 'synthese', blocs: [{ type: 'kpis', items: [{ cle: 'total', valeur: 3 }, { cle: 'net', valeur: 5250, unite: 'devise' }, { cle: 'delaiDetectionJours', valeur: 1.7, unite: 'jours' }] }] },
    { id: 'notifsEnRetard', blocs: [{ type: 'tableau', colonnes: ['rapports.cols.incident', 'rapports.cols.regime', 'rapports.cols.echeance'], lignes: [['Incident a', { k: 'notifRegimes.NIS2.label' }, '2026-09-13T08:00:00.000Z'], ['Incident b', 'Client X', null]] }] },
  ],
}

describe('rapport-render', () => {
  it('résout les clés i18n des cellules ; texte et nombres inchangés ; clé inconnue → clé', () => {
    expect(resoudreCellule({ k: 'notifRegimes.NIS2.label' }, tr)).toBe('NIS2 — Directive (UE) 2022/2555, art. 23')
    expect(resoudreCellule('Client X', tr)).toBe('Client X')
    expect(resoudreCellule(12, tr)).toBe(12)
    expect(resoudreCellule(null, tr)).toBe('')
    expect(resoudreCellule({ k: 'inconnue.cle' }, tr)).toBe('inconnue.cle')
  })
  it('titres de section et libellés de KPI traduits ; formatage devise, jours', () => {
    expect(titreSection('synthese', tr)).toBe('Synthèse')
    expect(libelleKpi('total', tr)).toBe('Incidents')
    expect(formaterKpi({ cle: 'net', valeur: 5250, unite: 'devise' }, 'EUR', 'fr')).toMatch(/5\s?250/)
    expect(formaterKpi({ cle: 'delaiDetectionJours', valeur: 1.7, unite: 'jours' }, 'EUR', 'fr')).toContain('1,7')
    expect(formaterKpi({ cle: 'conformite', valeur: 91, unite: 'pct' }, 'EUR', 'fr')).toBe('91 %')
  })
  it('feuilles d’export : une feuille par section, en-têtes traduits, KPI en paires libellé/valeur', () => {
    const f = contenuVersFeuilles(contenu, tr, 'fr')
    expect(f.map(x => x.nom)).toEqual(['Synthèse', 'Notifications en retard'])
    expect(f[0].lignes[0]).toEqual(['Incidents', 3])
    expect(f[1].lignes[0]).toEqual(['Incident', 'Régime', 'Échéance'])
    expect(f[1].lignes[1][1]).toBe('NIS2 — Directive (UE) 2022/2555, art. 23')
  })
  it('libellés du contrôle permanent : repli sur les sous-blocs dédiés', () => {
    expect(titreSection('controlesCles', tr)).toBe('Contrôles clés')
    expect(libelleKpi('tauxRealisation', tr)).toBe('Taux de réalisation')
    expect(libelleColonne('rapports.cols.periodesEnRetard', tr)).toBe('Périodes en retard')
    expect(resoudreCellule({ k: 'rapports.conception.ADEQUATE' }, tr)).toBe('Adéquate')
  })
  it('libellés de l’audit interne : repli sur les sous-blocs dédiés', () => {
    expect(titreSection('universAttention', tr)).toBe('Univers à planifier ou en retard')
    expect(libelleKpi('tauxVerification', tr)).toBe('Taux de vérification')
    expect(libelleColonne('rapports.cols.prochaine', tr)).toBe('Prochaine échéance')
    expect(resoudreCellule({ k: 'rapports.notations.3' }, tr)).toBe('Insuffisant')
  })
})
