import { describe, it, expect } from 'vitest'
import { buildComitePack, verdictGlobal, verdictDispositif, verdictSignauxActifs, baseEvaluation, COMITE_TYPES, type ComiteConsolide, valeursPack, ajouterTendances, texteTendance } from '../../../lib/comite-pack'

const MODULES_ON = { risques: true, appetit: true, incidents: true, controles: true, audit: true, regulateur: true, kri: true, dora: true }

const base: ComiteConsolide = {
  risques: { total: 20, eleve: 3, moyen: 7, faible: 8, nonCote: 2 },
  actions: { total: 12, faits: 5, enRetard: 4, tauxAvancement: 42 },
  appetit: { horsAppetit: 2, dansAppetit: 15, evalues: 17 },
  incidents: { total: 8, ouverts: 3, perteNette: 125000 },
  controles: { tauxConformite: 72, anomalies: 5 },
  audit: { critiques: 1, recosEnRetard: 2 },
  regulateur: { echues: 1, sous30j: 3 },
  kri: { enAlerte: 2, critique: 1 },
  dora: { majeurs: 1, evalues: 4 },
}

describe('buildComitePack', () => {
  it('produit les sections d’un comité des risques avec les modules fournis', () => {
    const pack = buildComitePack('RISQUES', base, { risques: true, appetit: true, incidents: true, controles: true, audit: true, regulateur: true, kri: true, dora: true })
    const ids = pack.sections.map(s => s.id)
    expect(ids).toContain('risques')
    expect(ids).toContain('appetit')
    expect(ids).toContain('incidents')
    expect(pack.type).toBe('RISQUES')
  })

  it('chaque indicateur à cible affiche sa cible (taux de conformité 80 % minimum, compteurs d’alerte à 0) ; les autres n’en ont pas', () => {
    const pack = buildComitePack('RISQUES', base, MODULES_ON)
    const m = (sec: string, key: string) => pack.sections.find(x => x.id === sec)!.metrics.find(x => x.key === key)!
    expect(m('controles', 'tauxConformite')).toMatchObject({ value: '72%', cible: '80%', cibleMinimum: true, alerte: true })
    expect(m('risques', 'actionsEnRetard').cible).toBe('0')
    expect(m('appetit', 'horsAppetit').cible).toBe('0')
    expect(m('kri', 'critique').cible).toBe('0')
    expect(m('risques', 'total').cible).toBeUndefined()
    expect(m('incidents', 'perteNette').cible).toBeUndefined()
  })

  it('omet les sections dont le module est inactif', () => {
    const pack = buildComitePack('RISQUES', base, { risques: true, appetit: false, incidents: false, controles: false, audit: false, regulateur: false, kri: false, dora: false })
    const ids = pack.sections.map(s => s.id)
    expect(ids).toEqual(['risques'])
  })

  it('remonte des points d’alerte (highlights) sur les seuils dépassés', () => {
    const pack = buildComitePack('RISQUES', base, { risques: true, appetit: true, incidents: true, controles: true, audit: true, regulateur: true, kri: true, dora: true })
    // hors appétit, actions en retard, conformité < 80, constats critiques, recos régulateur échues,
    // KRI critiques, incidents DORA majeurs → au moins un highlight de niveau 'alerte'.
    expect(pack.highlights.length).toBeGreaterThan(0)
    expect(pack.highlights.some(h => h.niveau === 'alerte')).toBe(true)
  })

  it('aucun highlight quand tout est au vert', () => {
    const sain: ComiteConsolide = {
      risques: { total: 10, eleve: 0, moyen: 2, faible: 8, nonCote: 0 },
      actions: { total: 5, faits: 5, enRetard: 0, tauxAvancement: 100 },
      appetit: { horsAppetit: 0, dansAppetit: 10, evalues: 10 },
      controles: { tauxConformite: 95, anomalies: 0 },
      audit: { critiques: 0, recosEnRetard: 0 },
      regulateur: { echues: 0, sous30j: 0 },
      kri: { enAlerte: 0, critique: 0 },
    }
    const pack = buildComitePack('RISQUES', sain, { risques: true, appetit: true, incidents: false, controles: true, audit: true, regulateur: true, kri: true, dora: false })
    expect(pack.highlights.filter(h => h.niveau === 'alerte')).toEqual([])
  })

  it('expose la liste des types de comité', () => {
    expect(COMITE_TYPES).toContain('RISQUES')
    expect(COMITE_TYPES).toContain('CONFORMITE')
    expect(COMITE_TYPES).toContain('INCIDENTS')
  })
})

describe('verdictGlobal (#134 M5 — verdict RAG en tête du pack décideur)', () => {
  it('aucune alerte → MAITRISE', () => {
    const pack = buildComitePack('RISQUES', { risques: { total: 5, eleve: 0, moyen: 2, faible: 3, nonCote: 0 } }, MODULES_ON)
    expect(verdictGlobal(pack).niveau).toBe('MAITRISE')
    expect(verdictGlobal(pack).alertes).toBe(0)
  })
  it('un signal de crise (constats critiques) → ELEVE', () => {
    const pack = buildComitePack('RISQUES', { audit: { critiques: 1, recosEnRetard: 0 } }, MODULES_ON)
    expect(verdictGlobal(pack).niveau).toBe('ELEVE')
  })
  it('des alertes non critiques (3) → MODERE', () => {
    const pack = buildComitePack('RISQUES', {
      appetit: { horsAppetit: 1, dansAppetit: 9, evalues: 10 },
      risques: { total: 3, eleve: 0, moyen: 0, faible: 3, nonCote: 0 }, actions: { total: 5, faits: 1, enRetard: 2, tauxAvancement: 20 },
      controles: { tauxConformite: 50, anomalies: 3 },
    }, MODULES_ON)
    expect(verdictGlobal(pack).niveau).toBe('MODERE')
  })
  it('une seule alerte non critique → MODERE', () => {
    const pack = buildComitePack('RISQUES', { appetit: { horsAppetit: 2, dansAppetit: 8, evalues: 10 } }, MODULES_ON)
    expect(verdictGlobal(pack).niveau).toBe('MODERE')
  })
})

describe('buildComitePack — heatmap (#134 M5)', () => {
  it('passe la grille heatmap du consolidé au pack ; absente si non fournie', () => {
    const grid = { gravites: [5, 4, 3, 2, 1], vraisemblances: [1, 2, 3, 4, 5], counts: {}, buckets: {} } as never
    const avec = buildComitePack('RISQUES', { risques: { total: 1, eleve: 0, moyen: 0, faible: 1, nonCote: 0, grid } }, MODULES_ON)
    expect(avec.heatmap).toBe(grid)
    const sans = buildComitePack('RISQUES', { risques: { total: 1, eleve: 0, moyen: 0, faible: 1, nonCote: 0 } }, MODULES_ON)
    expect(sans.heatmap).toBeUndefined()
  })
})

describe('verdictDispositif (#136 — verdict cockpit à partir des signaux bruts)', () => {
  it('signal de crise (DORA majeur) → ELEVE', () => {
    expect(verdictDispositif({ doraMajeurs: 3 }).niveau).toBe('ELEVE')
    expect(verdictDispositif({ constatsCritiques: 1 }).niveau).toBe('ELEVE')
  })
  it('alertes non critiques : 1 → MODERE, ≥4 → ELEVE', () => {
    expect(verdictDispositif({ horsAppetit: 2 }).niveau).toBe('MODERE')
    expect(verdictDispositif({ horsAppetit: 1, conformiteSousSeuil: true, actionsEnRetard: 3 }).niveau).toBe('MODERE')
    expect(verdictDispositif({ horsAppetit: 1, conformiteSousSeuil: true, actionsEnRetard: 3, doraMajeurs: 1 }).niveau).toBe('ELEVE')
  })
  it('aucun signal → MAITRISE', () => {
    expect(verdictDispositif({}).niveau).toBe('MAITRISE')
    expect(verdictDispositif({ horsAppetit: 0, conformiteSousSeuil: false }).alertes).toBe(0)
  })
})

describe('verdictSignauxActifs (détail « lesquels »)', () => {
  it('liste les signaux actifs, critiques en tête, et cadre avec le compte', () => {
    const s = { horsAppetit: 2, doraMajeurs: 1, actionsEnRetard: 5 }
    expect(verdictSignauxActifs(s)).toEqual(['doraMajeurs', 'horsAppetit', 'actionsEnRetard'])
    expect(verdictSignauxActifs(s).length).toBe(verdictDispositif(s).alertes)
  })
  it('conformiteSousSeuil ne compte que si true ; aucun → []', () => {
    expect(verdictSignauxActifs({ conformiteSousSeuil: false })).toEqual([])
    expect(verdictSignauxActifs({ conformiteSousSeuil: true })).toEqual(['conformiteSousSeuil'])
    expect(verdictSignauxActifs({})).toEqual([])
  })
})

describe('buildComitePack — flag positif (RAG vert, #134)', () => {
  it('« dans l’appétit » positif ; conformité ≥ seuil positif, < seuil alerte', () => {
    const pack = buildComitePack('RISQUES', {
      appetit: { horsAppetit: 0, dansAppetit: 10, evalues: 10 },
      controles: { tauxConformite: 92, anomalies: 0 },
    }, MODULES_ON)
    expect(pack.sections.find(s => s.id === 'appetit')!.metrics.find(m => m.key === 'dansAppetit')?.positif).toBe(true)
    expect(pack.sections.find(s => s.id === 'controles')!.metrics.find(m => m.key === 'tauxConformite')?.positif).toBe(true)
    const bas = buildComitePack('RISQUES', { controles: { tauxConformite: 50, anomalies: 1 } }, MODULES_ON)
    const ctrlBas = bas.sections.find(s => s.id === 'controles')!.metrics.find(m => m.key === 'tauxConformite')
    expect(ctrlBas?.positif).toBeFalsy()
    expect(ctrlBas?.alerte).toBe(true)
  })
})

// Tendance ↑↓ (cadrage 2026-10-11, option a) : photo mensuelle des indicateurs (clé « section.indicateur », valeurs
// numériques) ; tendance par rapport à la photo du 1er du mois (état de fin du mois précédent) ; sens favorable : baisse
// pour les compteurs d'alerte, hausse pour les taux et ce qui est « dans l'appétit ».
describe('tendance des indicateurs du comité', () => {
  const c: ComiteConsolide = { risques: { total: 10, eleve: 3, moyen: 4, faible: 3, nonCote: 0 }, actions: { total: 20, faits: 10, enRetard: 2, tauxAvancement: 50 } }
  const m = { risques: true, appetit: false, incidents: false, controles: false, audit: false, regulateur: false, kri: false, dora: false }
  it('valeurs numériques indexées par section, pourcentages convertis, valeurs non numériques ignorées', () => {
    const v = valeursPack([buildComitePack('RISQUES', c, m)])
    expect(v['risques.eleve']).toBe(3)
    expect(v['risques.avancement']).toBe(50)
    expect(Object.keys(v).every(k => k.includes('.'))).toBe(true)
  })
  it('écart et sens favorable par rapport à la photo ; sans photo, aucune tendance', () => {
    const pack = ajouterTendances(buildComitePack('RISQUES', c, m), { 'risques.eleve': 5, 'risques.avancement': 40, 'risques.actionsEnRetard': 2, 'risques.total': 8 })
    const met = (s: string, k: string) => pack.sections.find(x => x.id === s)!.metrics.find(x => x.key === k)!
    expect(met('risques', 'eleve').tendance).toEqual({ precedent: 5, delta: -2, sens: 'BAISSE', favorable: true })
    expect(met('risques', 'avancement').tendance).toEqual({ precedent: 40, delta: 10, sens: 'HAUSSE', favorable: true })
    expect(met('risques', 'actionsEnRetard').tendance).toEqual({ precedent: 2, delta: 0, sens: 'STABLE', favorable: null })
    expect(met('risques', 'total').tendance?.favorable).toBeNull() // pas de sens favorable défini
    expect(ajouterTendances(buildComitePack('RISQUES', c, m), null).sections[0].metrics[0].tendance).toBeUndefined()
  })
})

describe('texteTendance (PDF, police sans flèches)', () => {
  it('écart signé, « = » si stable, suffixe de la langue', () => {
    expect(texteTendance({ precedent: 5, delta: -2, sens: 'BAISSE', favorable: true }, 'vs mois préc.')).toBe('-2 vs mois préc.')
    expect(texteTendance({ precedent: 40, delta: 10, sens: 'HAUSSE', favorable: true }, 'vs prev. month')).toBe('+10 vs prev. month')
    expect(texteTendance({ precedent: 2, delta: 0, sens: 'STABLE', favorable: null }, 'vs mois préc.')).toBe('= vs mois préc.')
  })
})

// Recette n° 48 : pas de « MAÎTRISÉ » sans base d'évaluation. 1) « Non évaluable » sans aucun risque coté (motifs
// listés) ; 2) les alertes l'emportent ; 3) « maîtrisé, base partielle » ; 4) incident à qualifier = alerte ;
// 5) même règle pour le cockpit, le dossier de comité et le rapport direction.
describe('verdict — base d’évaluation (recette n° 48)', () => {
  const vide = baseEvaluation({ risques: { total: 5, eleve: 0, moyen: 0, faible: 0, nonCote: 5 }, controles: { tauxConformite: null, anomalies: 0 }, kri: { enAlerte: 0, critique: 0, total: 2, evalues: 0 } }, { controles: true, kri: true })
  it('aucun risque coté et aucune alerte → NON_EVALUABLE, avec les motifs', () => {
    const v = verdictDispositif({}, vide)
    expect(v.niveau).toBe('NON_EVALUABLE')
    expect(v.manques).toEqual([{ cle: 'risquesNonCotes', n: 5 }, { cle: 'conformiteNonEvaluee' }, { cle: 'kriNonEvalues' }])
    expect(verdictDispositif({}, baseEvaluation({}, { controles: false, kri: false })).niveau).toBe('NON_EVALUABLE')
  })
  it('les alertes l’emportent sur l’évaluation incomplète', () => {
    expect(verdictDispositif({ constatsCritiques: 1 }, vide).niveau).toBe('ELEVE')
    expect(verdictDispositif({ actionsEnRetard: 2 }, vide).niveau).toBe('MODERE')
  })
  it('risques cotés mais conformité ou KRI non évalués → MAITRISE, base partielle', () => {
    const b = baseEvaluation({ risques: { total: 5, eleve: 0, moyen: 2, faible: 1, nonCote: 2 }, controles: { tauxConformite: null, anomalies: 0 } }, { controles: true, kri: false })
    const v = verdictDispositif({}, b)
    expect(v.niveau).toBe('MAITRISE')
    expect(v.partiel).toBe(true)
    expect(v.manques).toEqual([{ cle: 'risquesNonCotes', n: 2 }, { cle: 'conformiteNonEvaluee' }])
    const complet = verdictDispositif({}, baseEvaluation({ risques: { total: 3, eleve: 0, moyen: 1, faible: 2, nonCote: 0 }, controles: { tauxConformite: 95, anomalies: 0 }, kri: { enAlerte: 0, critique: 0, total: 1, evalues: 1 } }, { controles: true, kri: true }))
    expect(complet).toMatchObject({ niveau: 'MAITRISE', partiel: false, manques: [] })
  })
  it('un incident à qualifier est un signal d’alerte (non critique)', () => {
    expect(verdictSignauxActifs({ incidentsAQualifier: 2 })).toEqual(['incidentsAQualifier'])
    expect(verdictDispositif({ incidentsAQualifier: 2 }).niveau).toBe('MODERE')
  })
  it('sans base fournie : comportement inchangé (rétrocompatible)', () => {
    expect(verdictDispositif({})).toMatchObject({ niveau: 'MAITRISE', manques: [], partiel: false })
  })
  it('dossier de comité : même règle (base calculée à la construction du pack)', () => {
    const pack = buildComitePack('RISQUES', { risques: { total: 5, eleve: 0, moyen: 0, faible: 0, nonCote: 5 }, incidents: { total: 2, ouverts: 2, perteNette: 0, aQualifier: 0 } }, MODULES_ON)
    expect(verdictGlobal(pack).niveau).toBe('NON_EVALUABLE')
    const avecIncident = buildComitePack('RISQUES', { risques: { total: 5, eleve: 0, moyen: 0, faible: 0, nonCote: 5 }, incidents: { total: 2, ouverts: 2, perteNette: 0, aQualifier: 1 } }, MODULES_ON)
    expect(verdictGlobal(avecIncident).niveau).toBe('MODERE')
  })
})

