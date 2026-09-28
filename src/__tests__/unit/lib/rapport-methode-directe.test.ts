// P4 — rapport par méthode (ISO/IEC 27005:2022, ISO 31000:2018, NIST SP 800-30 Rev. 1).
import { describe, expect, it } from 'vitest'
import { resolveScaleConfig } from '@/lib/risk-scale'
import { APPETIT_DEFAULT } from '@/lib/appetit'
import { buildDirectReport, REPORT_STRINGS, reportStrings } from '@/lib/rapport-methode-directe'

const ctx = { scale: resolveScaleConfig(null), appetit: APPETIT_DEFAULT }
const input = {
  analyse: { nom: 'SI Santé', methode: 'ISO_27005', cadrage: { perimetre: 'DPI', objectifsEtude: 'Critères : G×V' } },
  risques: [
    { id: 'a', nom: 'Fuite', gravite: 2, vraisemblance: 2, niveauRisque: 4, strategie: 'REDUIRE', proprietaire: null, vulnerabilites: [{ description: 'MFA absent' }] },
    { id: 'b', nom: 'Rançongiciel', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE', proprietaire: 'DSI', graviteActuelle: 4, vraisemblanceActuelle: 3, niveauActuel: 12, graviteResiduelle: 2, vraisemblanceResiduelle: 2, niveauResiduel: 4 },
  ],
  mesures: [{ nom: 'Sauvegardes hors ligne', statut: 'REALISE', efficacite: 3, echeance: null, responsable: 'DSI', risqueId: 'b' }, { nom: 'Orpheline', statut: 'A_FAIRE', efficacite: null, echeance: null, responsable: null, risqueId: null }],
  plans: [{ titre: 'Segmenter le réseau', statut: 'EN_COURS', priorite: 'CRITIQUE', echeance: new Date('2026-12-31'), porteur: 'RSSI', risqueIds: ['b'] }],
}

describe('buildDirectReport', () => {
  const r = buildDirectReport(input, ctx)

  it('cite la norme et sa version (métadonnées de la méthode)', () => {
    expect(r.standard).toBe('ISO/IEC 27005:2022')
    expect(r.contexte).toEqual({ perimetre: 'DPI', objectifs: 'Critères : G×V' })
  })

  it('registre trié par niveau évalué décroissant, références R1..Rn, décision et palier de l’org', () => {
    expect(r.registre.map(x => [x.ref, x.nom, x.actuel.niveau, x.decision, x.palier.label])).toEqual([
      ['R1', 'Rançongiciel', 12, 'treat', 'Critique'],
      ['R2', 'Fuite', 4, 'accept', 'Modéré'],
    ])
    expect(r.registre[0]).toMatchObject({ proprietaire: 'DSI', brut: { niveau: 12 }, residuel: { niveau: 4 }, nbMesures: 1, nbPlans: 1 })
  })

  it('vulnérabilités, mesures et plans rattachés à la référence du risque (orphelins signalés)', () => {
    expect(r.vulnerabilites).toEqual([{ ref: 'R2', risque: 'Fuite', description: 'MFA absent' }])
    expect(r.mesures.map(m => [m.ref, m.nom])).toEqual([['R1', 'Sauvegardes hors ligne'], ['—', 'Orpheline']])
    expect(r.plans).toEqual([{ refs: 'R1', titre: 'Segmenter le réseau', statut: 'EN_COURS', priorite: 'CRITIQUE', echeance: '2026-12-31', porteur: 'RSSI' }])
  })

  it('synthèse : décisions, sans propriétaire, répartition par palier', () => {
    expect(r.synthese).toMatchObject({ total: 2, aTraiter: 1, acceptables: 1, sansProprietaire: 1, mesures: 2, plans: 1 })
    expect(r.synthese.parPalier.map(p => [p.label, p.count])).toEqual([['Faible', 0], ['Modéré', 1], ['Élevé', 0], ['Critique', 1]])
  })
})

describe('REPORT_STRINGS', () => {
  it('mêmes clés dans les 5 langues, repli sur le français', () => {
    const keys = Object.keys(REPORT_STRINGS.fr).sort()
    for (const l of ['en', 'de', 'es', 'it']) expect(Object.keys(REPORT_STRINGS[l]).sort()).toEqual(keys)
    expect(reportStrings('xx')).toBe(REPORT_STRINGS.fr)
  })

  it('libellés PDF sans caractère hors WinAnsi (police standard Helvetica)', () => {
    for (const [l, S] of Object.entries(REPORT_STRINGS)) {
      const all = JSON.stringify(S)
      expect([...all].filter(ch => ch.codePointAt(0)! > 0xff && !'’“”«»–—…€'.includes(ch)), l).toEqual([])
    }
  })
})
