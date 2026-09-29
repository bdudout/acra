import { describe, expect, it } from 'vitest'
import { masquerContenu, appliquerGabarit, sanitizeGabarits, sanitizeRapportsConfig, editionsAPlanifier } from '@/lib/rapport-masquage'
import type { RapportContenu } from '@/lib/rapport-model'

const contenu: RapportContenu = {
  code: 'R-INC-1', periode: { debut: '2026-01-01', fin: '2026-03-31' }, genereLe: '2026-04-01T00:00:00Z', deviseReference: 'EUR',
  sections: [
    { id: 'synthese', blocs: [{ type: 'kpis', items: [{ cle: 'total', valeur: 3 }] }] },
    { id: 'notifsEnRetard', blocs: [{ type: 'tableau', colonnes: ['rapports.cols.incident', 'rapports.cols.regime', 'rapports.cols.responsable'], lignes: [['Ransomware Siège', 'NIS2', 'Alice'], ['Fuite RH', 'RGPD', 'Bob'], ['Ransomware Siège', 'RGPD', 'Alice'], [null, 'X', { k: 'rapports.nonRenseigne' }]] }] },
  ],
}

describe('masquage des données identifiantes', () => {
  it('pseudonymise de façon cohérente les colonnes identifiantes, laisse le reste', () => {
    const m = masquerContenu(contenu)
    const t = m.sections[1].blocs[0]
    expect(t.type === 'tableau' && t.lignes).toEqual([['#1', 'NIS2', '#1'], ['#2', 'RGPD', '#2'], ['#1', 'RGPD', '#1'], [null, 'X', { k: 'rapports.nonRenseigne' }]])
    expect(m.sections[0]).toEqual(contenu.sections[0])
  })
  it('ne modifie pas l’original (édition figée)', () => {
    masquerContenu(contenu)
    const t = contenu.sections[1].blocs[0]
    expect(t.type === 'tableau' && t.lignes[0][0]).toBe('Ransomware Siège')
  })
})

describe('gabarits surchargeables', () => {
  it('assainit : titre/introduction bornés, sections à masquer, codes connus seulement', () => {
    const g = sanitizeGabarits({ 'R-INC-1': { titre: '  Revue trimestrielle  ', introduction: 'x'.repeat(3000), sectionsMasquees: ['parType', 5, 'parType'] }, 'R-XXX': { titre: 'no' }, 'R-PER-2': 'nimporte' })
    expect(g).toEqual({ 'R-INC-1': { titre: 'Revue trimestrielle', introduction: 'x'.repeat(2000), sectionsMasquees: ['parType'] } })
  })
  it('retire les sections masquées, sans toucher le contenu figé', () => {
    const r = appliquerGabarit(contenu, { sectionsMasquees: ['synthese'] })
    expect(r.sections.map(s => s.id)).toEqual(['notifsEnRetard'])
    expect(contenu.sections).toHaveLength(2)
    expect(appliquerGabarit(contenu, undefined)).toBe(contenu)
  })
})

describe('configuration des rapports', () => {
  it('valeurs sûres par défaut', () => {
    expect(sanitizeRapportsConfig(undefined)).toEqual({ gabarits: {}, planifies: [] })
    expect(sanitizeRapportsConfig({ gabarits: { 'R-INC-1': { titre: 'T' } } })).toEqual({ gabarits: { 'R-INC-1': { titre: 'T' } }, planifies: [] })
  })
  it('planifications : codes connus, fréquence valide, une par rapport', () => {
    expect(sanitizeRapportsConfig({ planifies: [{ code: 'R-INC-1', frequence: 'MENSUEL' }, { code: 'R-INC-1', frequence: 'TRIMESTRIEL' }, { code: 'R-ZZZ', frequence: 'MENSUEL' }, { code: 'R-PER-2', frequence: 'HEBDO' }, 'x'] }).planifies)
      .toEqual([{ code: 'R-INC-1', frequence: 'MENSUEL' }])
  })
})

describe('editionsAPlanifier', () => {
  const pl = [{ code: 'R-INC-1' as const, frequence: 'MENSUEL' as const }, { code: 'R-PER-2' as const, frequence: 'TRIMESTRIEL' as const }]
  it('1er–3 du mois : brouillon de la période précédente ; trimestriel seulement au 1er mois du trimestre', () => {
    expect(editionsAPlanifier(pl, [], new Date('2026-10-02T05:00:00Z'))).toEqual([
      { code: 'R-INC-1', periode: { debut: '2026-09-01', fin: '2026-09-30' } },
      { code: 'R-PER-2', periode: { debut: '2026-07-01', fin: '2026-09-30' } },
    ])
    expect(editionsAPlanifier(pl, [], new Date('2026-11-02T05:00:00Z')).map(x => x.code)).toEqual(['R-INC-1'])
  })
  it('hors fenêtre (après le 3) ou édition déjà présente : rien', () => {
    expect(editionsAPlanifier(pl, [], new Date('2026-10-15T05:00:00Z'))).toEqual([])
    expect(editionsAPlanifier(pl, [{ code: 'R-INC-1', debut: '2026-09-01', fin: '2026-09-30' }], new Date('2026-10-02T05:00:00Z')).map(x => x.code)).toEqual(['R-PER-2'])
  })
})
