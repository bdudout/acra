import { describe, it, expect } from 'vitest'
import { synthetiserCouverture, croiserApplicationsAnalyses, type ControleCouvrant, type ConstatExigence } from '../../../lib/couverture-referentiel'

const exigences = [{ ref: 'A1' }, { ref: 'A2' }, { ref: 'A3' }, { ref: 'A4' }]

describe('synthetiserCouverture', () => {
  it('marque non couvert une exigence sans contrôle actif', () => {
    const c = synthetiserCouverture(exigences, [], [])
    expect(c.parExigence.every(e => e.statut === 'NON_COUVERT')).toBe(true)
    expect(c.synthese).toMatchObject({ total: 4, couverts: 0, conformes: 0, nonCouverts: 4, tauxCouverture: 0, tauxConformite: 0 })
  })

  it('dérive le statut selon l’efficacité des contrôles couvrants', () => {
    const controles: ControleCouvrant[] = [
      { exigenceRefs: ['A1'], efficacite: 'FORTE', actif: true },       // A1 → CONFORME
      { exigenceRefs: ['A2'], efficacite: 'MOYENNE', actif: true },      // A2 → PARTIEL
      { exigenceRefs: ['A3'], efficacite: 'FAIBLE', actif: true },       // A3 → ANOMALIE
      { exigenceRefs: ['A4'], efficacite: null, actif: true },           // A4 → PARTIEL (pas encore évalué)
    ]
    const c = synthetiserCouverture(exigences, controles, [])
    const s = Object.fromEntries(c.parExigence.map(e => [e.ref, e.statut]))
    expect(s).toEqual({ A1: 'CONFORME', A2: 'PARTIEL', A3: 'ANOMALIE', A4: 'PARTIEL' })
    expect(c.synthese.couverts).toBe(4)
    expect(c.synthese.conformes).toBe(1)
  })

  it('un contrôle FAIBLE dégrade même si un autre est FORT', () => {
    const controles: ControleCouvrant[] = [
      { exigenceRefs: ['A1'], efficacite: 'FORTE', actif: true },
      { exigenceRefs: ['A1'], efficacite: 'FAIBLE', actif: true },
    ]
    expect(synthetiserCouverture([{ ref: 'A1' }], controles, []).parExigence[0].statut).toBe('ANOMALIE')
  })

  it('un constat d’audit ouvert sur l’exigence force ANOMALIE', () => {
    const controles: ControleCouvrant[] = [{ exigenceRefs: ['A1'], efficacite: 'FORTE', actif: true }]
    const constats: ConstatExigence[] = [{ exigenceRef: 'A1', statut: 'OUVERT' }]
    const c = synthetiserCouverture([{ ref: 'A1' }], controles, constats)
    expect(c.parExigence[0].statut).toBe('ANOMALIE')
    expect(c.parExigence[0].nbAnomaliesAudit).toBe(1)
  })

  it('un constat RÉSOLU ne dégrade pas', () => {
    const controles: ControleCouvrant[] = [{ exigenceRefs: ['A1'], efficacite: 'FORTE', actif: true }]
    const constats: ConstatExigence[] = [{ exigenceRef: 'A1', statut: 'RESOLU' }]
    expect(synthetiserCouverture([{ ref: 'A1' }], controles, constats).parExigence[0].statut).toBe('CONFORME')
  })

  it('ignore les contrôles inactifs', () => {
    const controles: ControleCouvrant[] = [{ exigenceRefs: ['A1'], efficacite: 'FORTE', actif: false }]
    expect(synthetiserCouverture([{ ref: 'A1' }], controles, []).parExigence[0].statut).toBe('NON_COUVERT')
  })

  it('calcule les taux (couverture et conformité) sur le total d’exigences', () => {
    const controles: ControleCouvrant[] = [
      { exigenceRefs: ['A1', 'A2'], efficacite: 'FORTE', actif: true },
    ]
    const c = synthetiserCouverture(exigences, controles, [])
    expect(c.synthese.couverts).toBe(2)
    expect(c.synthese.tauxCouverture).toBe(50)
    expect(c.synthese.tauxConformite).toBe(50)
  })
})

describe('croiserApplicationsAnalyses — jointure RA ↔ référentiel', () => {
  const analyses = [
    { id: 'a1', nom: 'Analyse SI', referentiels: [{ code: 'ISO27001', etatApplication: 'APPLIQUE' }, { nom: 'DORA', etatApplication: 'PARTIEL' }] },
    { id: 'a2', nom: 'Analyse paiements', referentiels: [{ nom: 'DORA', code: 'DORA', applicable: false }] },
    { id: 'a3', nom: 'Analyse RH', referentiels: [{ nom: 'ISO/IEC 27001:2022' }] }, // code résolu par le nom
    { id: 'a4', nom: 'Analyse vide', referentiels: [] },
  ]

  it('compte les analyses appliquant un code + leur état (résolution nom→code incluse)', () => {
    const r = croiserApplicationsAnalyses(analyses, 'ISO27001')
    expect(r.total).toBe(2) // a1 (code) + a3 (résolu par le nom)
    expect(r.appliques).toBe(2) // a1 APPLIQUE ; a3 défaut APPLIQUE
    expect(r.analyses.map(a => a.analyseId).sort()).toEqual(['a1', 'a3'])
  })

  it('distingue appliqué / partiel / non appliqué', () => {
    const r = croiserApplicationsAnalyses(analyses, 'DORA')
    expect(r.total).toBe(2) // a1 (partiel) + a2 (non appliqué)
    expect(r.partiels).toBe(1)
    expect(r.nonAppliques).toBe(1)
  })

  it('retourne un total nul pour un code non appliqué', () => {
    expect(croiserApplicationsAnalyses(analyses, 'LCB_FT').total).toBe(0)
    expect(croiserApplicationsAnalyses([], 'ISO27001').total).toBe(0)
  })
})
