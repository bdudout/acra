/**
 * metier-edge-cases.test.ts — cas LIMITES des logiques métier clés.
 *
 * Les suites existantes couvrent le comportement nominal de chaque moteur ;
 * ce fichier verrouille les BRANCHES de bord (repli hors-plage, égalité exacte
 * aux seuils, tendances stables/inconnues, entrées vides) qui sont les plus
 * susceptibles de régresser silencieusement.
 */
import { describe, it, expect } from 'vitest'
import { getRiskLevel, getRiskTier, type ScaleConfig } from '@/lib/risk-scale'
import { evaluerAppetit, seuilApplicable, type AppetitConfig } from '@/lib/appetit'
import { evaluerKri, tendanceKri, type KriSeuils } from '@/lib/kri'
import { resolveModuleActivation, sanitizeModulesPolicy } from '@/lib/module-policy'
import { consolidateTiers, suggestTierDuplicates, validateMergeRequest } from '@/lib/tiers'

// ─── 1. Cotation du risque — repli hors-plage & qualitatif invalide ───────────
describe('risk-scale — bords', () => {
  const seuils = [
    { scoreMin: 5,  scoreMax: 10, label: 'Bas',  couleur: '#22c55e' },
    { scoreMin: 11, scoreMax: 20, label: 'Haut', couleur: '#ef4444' },
  ]

  it('score SOUS le minimum couvert → premier seuil (repli bas, jamais null)', () => {
    // score = 1×1 = 1, sous 5 → 'Bas'
    expect(getRiskLevel(1, 1, { seuilsMatrice: seuils }).label).toBe('Bas')
  })

  it('score AU-DESSUS du maximum couvert → dernier seuil (repli haut)', () => {
    // score = 5×5 = 25, au-dessus de 20 → 'Haut'
    expect(getRiskLevel(5, 5, { seuilsMatrice: seuils }).label).toBe('Haut')
  })

  it('mode QUALITATIF avec un libellé de seuil inconnu → repli sur le quantitatif', () => {
    const cfg: Partial<ScaleConfig> = {
      matriceMode: 'QUALITATIVE',
      matriceQualitative: [{ gravite: 1, vraisemblance: 1, seuilLabel: 'INEXISTANT' }],
      seuilsMatrice: seuils,
    }
    // case définie mais label absent des seuils → quantitatif : score 1 → 'Bas'
    expect(getRiskLevel(1, 1, cfg).label).toBe('Bas')
  })

  it('getRiskTier respecte les frontières inclusives 4 / 8 / 12', () => {
    expect(getRiskTier(3)).toBe('faible')
    expect(getRiskTier(4)).toBe('modere')
    expect(getRiskTier(7)).toBe('modere')
    expect(getRiskTier(8)).toBe('eleve')
    expect(getRiskTier(11)).toBe('eleve')
    expect(getRiskTier(12)).toBe('critique')
  })
})

// ─── 2. Résolution des modules (politique d'instance) — bords ─────────────────
describe('module-policy — bords', () => {
  it('politique null/undefined → délègue à la valeur d’organisation', () => {
    expect(resolveModuleActivation(null, true)).toBe(true)
    expect(resolveModuleActivation(undefined, false)).toBe(false)
  })

  it('la politique d’instance SURPLOMBE la valeur d’org dans les deux sens', () => {
    expect(resolveModuleActivation('FORCE_ON', false)).toBe(true)   // imposé malgré org OFF
    expect(resolveModuleActivation('FORCE_OFF', true)).toBe(false)  // interdit malgré org ON
  })

  it('sanitize : ne garde que les modules connus + états valides (mélange)', () => {
    const out = sanitizeModulesPolicy({
      registreRisques: 'FORCE_ON', // valide
      incidents: 'BOGUS',          // état invalide → ignoré
      moduleInconnu: 'FORCE_ON',   // clé inconnue → ignorée
    })
    expect(out).toEqual({ registreRisques: 'FORCE_ON' })
  })

  it('sanitize : tableau ou primitive → objet vide', () => {
    expect(sanitizeModulesPolicy(['FORCE_ON'])).toEqual({})
    expect(sanitizeModulesPolicy('FORCE_ON')).toEqual({})
  })
})

// ─── 3. Appétit au risque — égalité au seuil & surcharge à zéro ───────────────
describe('appetit — bords', () => {
  it('résiduel ÉGAL au seuil est DANS (le seuil est acceptable, dépassement STRICT)', () => {
    expect(evaluerAppetit(10, 10)).toBe('DANS')
    expect(evaluerAppetit(11, 10)).toBe('HORS')
  })

  it('sans seuil ou sans cotation → INCONNU', () => {
    expect(evaluerAppetit(null, 10)).toBe('INCONNU')
    expect(evaluerAppetit(10, null)).toBe('INCONNU')
  })

  it('surcharge de catégorie à 0 prime sur le global (présence de clé, pas véracité)', () => {
    const cfg: AppetitConfig = { seuilGlobal: 20, parCategorie: { GOUV: 0 } }
    expect(seuilApplicable(cfg, 'GOUV')).toBe(0)   // surcharge 0 ≠ « pas de surcharge »
    expect(seuilApplicable(cfg, 'AUTRE')).toBe(20) // pas de surcharge → global
    expect(seuilApplicable(cfg, null)).toBe(20)    // pas de catégorie → global
  })
})

// ─── 4. KRI — bornes inclusives des seuils & tendance ─────────────────────────
describe('kri — bords', () => {
  const hausse: KriSeuils = { sens: 'HAUSSE', seuilAlerte: 5, seuilCritique: 10 }
  const baisse: KriSeuils = { sens: 'BAISSE', seuilAlerte: 5, seuilCritique: 2 }

  it('HAUSSE : valeur = seuil critique/alerte → borne INCLUSIVE', () => {
    expect(evaluerKri(10, hausse)).toBe('CRITIQUE')
    expect(evaluerKri(5, hausse)).toBe('ALERTE')
    expect(evaluerKri(4, hausse)).toBe('NORMAL')
  })

  it('BAISSE : plus bas = pire, bornes inclusives', () => {
    expect(evaluerKri(2, baisse)).toBe('CRITIQUE')
    expect(evaluerKri(5, baisse)).toBe('ALERTE')
    expect(evaluerKri(6, baisse)).toBe('NORMAL')
  })

  it('valeur non finie (NaN) ou absente → INCONNU', () => {
    expect(evaluerKri(NaN, hausse)).toBe('INCONNU')
    expect(evaluerKri(undefined, hausse)).toBe('INCONNU')
    expect(evaluerKri(null, baisse)).toBe('INCONNU')
  })

  it('tendance : valeurs égales → STABLE, manquante → INCONNU', () => {
    expect(tendanceKri(3, 3, 'HAUSSE')).toBe('STABLE')
    expect(tendanceKri(3, null, 'HAUSSE')).toBe('INCONNU')
  })

  it('tendance : une hausse DÉGRADE en sens HAUSSE, AMÉLIORE en sens BAISSE', () => {
    expect(tendanceKri(8, 5, 'HAUSSE')).toBe('DEGRADATION')
    expect(tendanceKri(8, 5, 'BAISSE')).toBe('AMELIORATION')
  })
})

// ─── 5. Consolidation des tiers — entrées vides & borne de fusion ─────────────
describe('tiers — bords', () => {
  it('consolidateTiers([]) et suggestTierDuplicates([]) → [] (aucune entrée)', () => {
    expect(consolidateTiers([])).toEqual([])
    expect(suggestTierDuplicates([])).toEqual([])
  })

  it('validateMergeRequest : exactement 2 noms distincts + cible valide → null (borne mini)', () => {
    expect(validateMergeRequest(['Microsoft', 'Microsoft Azure'], 'Microsoft')).toBe(null)
  })

  it('validateMergeRequest : un seul nom distinct → rejet (pas_assez_de_noms)', () => {
    expect(validateMergeRequest(['Microsoft', 'Microsoft'], 'Microsoft')).toBe('pas_assez_de_noms')
  })
})
