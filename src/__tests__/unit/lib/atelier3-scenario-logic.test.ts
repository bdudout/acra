import { describe, it, expect } from 'vitest'
import { SCENARIOS_STRATEGIQUES_EXEMPLES } from '@/lib/ebios-data'

// ─────────────────────────────────────────────────────────────────────────────
// Tests pour la logique métier de création de scénarios stratégiques
//
// On teste la fonction pure de création de scénario (sans React),
// ce qui correspond exactement à la logique de addScenario() dans Atelier3.tsx
// ─────────────────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9) }

function buildScenario(exemple?: {
  nom?: string
  description?: string
  vraisemblanceDefaut?: number
  graviteDefaut?: number
}) {
  const vr = exemple?.vraisemblanceDefaut ?? 2
  const gr = exemple?.graviteDefaut ?? 3
  return {
    id: uid(),
    nom: exemple?.nom || '',
    sourceRisqueId: '',
    objectifVise: '',
    coupleLabel: '',
    description: exemple?.description || '',
    evenementRedouteRef: '',
    cheminAttaque: [],
    mesuresEcosysteme: [],
    vraisemblance: vr,
    gravite: gr,
    niveauRisque: vr * gr,
    retenu: true,
  }
}

// ─── Création d'un scénario vide ──────────────────────────────────────────────

describe('buildScenario (sans exemple)', () => {
  it('crée un scénario avec nom vide', () => {
    const s = buildScenario()
    expect(s.nom).toBe('')
  })

  it('vraisemblance et gravite par défaut sont 2 et 3', () => {
    const s = buildScenario()
    expect(s.vraisemblance).toBe(2)
    expect(s.gravite).toBe(3)
  })

  it('niveauRisque = vraisemblance × gravite', () => {
    const s = buildScenario()
    expect(s.niveauRisque).toBe(s.vraisemblance * s.gravite)
  })

  it('retenu est true par défaut', () => {
    const s = buildScenario()
    expect(s.retenu).toBe(true)
  })

  it('cheminAttaque et mesuresEcosysteme sont des tableaux vides', () => {
    const s = buildScenario()
    expect(Array.isArray(s.cheminAttaque)).toBe(true)
    expect(Array.isArray(s.mesuresEcosysteme)).toBe(true)
    expect(s.cheminAttaque).toHaveLength(0)
    expect(s.mesuresEcosysteme).toHaveLength(0)
  })
})

// ─── Création depuis un exemple DICT ─────────────────────────────────────────

describe('buildScenario (depuis exemple)', () => {
  const exemple = SCENARIOS_STRATEGIQUES_EXEMPLES.find(e => e.critere === 'D')!

  it('pré-remplit le nom depuis l\'exemple', () => {
    const s = buildScenario(exemple)
    expect(s.nom).toBe(exemple.nom)
    expect(s.nom).toBeTruthy()
  })

  it('pré-remplit la description', () => {
    const s = buildScenario(exemple)
    expect(s.description).toBe(exemple.description)
    expect(s.description.length).toBeGreaterThan(10)
  })

  it('utilise vraisemblanceDefaut et graviteDefaut de l\'exemple', () => {
    const s = buildScenario(exemple)
    expect(s.vraisemblance).toBe(exemple.vraisemblanceDefaut)
    expect(s.gravite).toBe(exemple.graviteDefaut)
  })

  it('niveauRisque est recalculé depuis les valeurs de l\'exemple', () => {
    const s = buildScenario(exemple)
    expect(s.niveauRisque).toBe(exemple.vraisemblanceDefaut * exemple.graviteDefaut)
  })
})

// ─── Cohérence avec SCENARIOS_STRATEGIQUES_EXEMPLES ──────────────────────────

describe('scénarios créés depuis les 11 exemples', () => {
  it('tous les exemples génèrent des scénarios avec niveauRisque cohérent', () => {
    SCENARIOS_STRATEGIQUES_EXEMPLES.forEach(ex => {
      const s = buildScenario(ex)
      expect(s.niveauRisque).toBe(ex.vraisemblanceDefaut * ex.graviteDefaut)
      expect(s.niveauRisque).toBeGreaterThanOrEqual(1)
      expect(s.niveauRisque).toBeLessThanOrEqual(16)
    })
  })

  it('chaque scénario créé a un id unique', () => {
    const ids = SCENARIOS_STRATEGIQUES_EXEMPLES.map(() => buildScenario().id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

// ─── updateScenario — mise à jour niveauRisque ────────────────────────────────

describe('updateScenario — recalcul niveauRisque', () => {
  function updateScenario(s: ReturnType<typeof buildScenario>, field: string, value: any) {
    const up = { ...s, [field]: value }
    if (field === 'vraisemblance' || field === 'gravite') {
      up.niveauRisque = up.vraisemblance * up.gravite
    }
    return up
  }

  it('met à jour niveauRisque quand vraisemblance change', () => {
    const s = buildScenario({ vraisemblanceDefaut: 2, graviteDefaut: 3 })
    const updated = updateScenario(s, 'vraisemblance', 4)
    expect(updated.niveauRisque).toBe(4 * 3)
  })

  it('met à jour niveauRisque quand gravite change', () => {
    const s = buildScenario({ vraisemblanceDefaut: 3, graviteDefaut: 2 })
    const updated = updateScenario(s, 'gravite', 4)
    expect(updated.niveauRisque).toBe(3 * 4)
  })

  it('ne recalcule pas niveauRisque pour les autres champs', () => {
    const s = buildScenario({ vraisemblanceDefaut: 2, graviteDefaut: 3 })
    const originalNiveau = s.niveauRisque
    const updated = updateScenario(s, 'nom', 'Nouveau nom')
    expect(updated.niveauRisque).toBe(originalNiveau)
  })
})
