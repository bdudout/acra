import { describe, it, expect } from 'vitest'
import {
  validateIncidentInput, cleanIncidentInput, perteNette, delaiDetection,
  estTerminal, transitionAutorisee, qualificationComplete, suggestCalibration,
  INCIDENT_STATUTS, estPromouvable, promoteToRisk,
} from '@/lib/incident'

describe('validateIncidentInput', () => {
  it('intitulé requis', () => {
    expect(validateIncidentInput({ intitule: '   ' })).toBe('intitule_requis')
    expect(validateIncidentInput({ intitule: 'Virement frauduleux' })).toBeNull()
  })
  it('dates invalides refusées', () => {
    expect(validateIncidentInput({ intitule: 'X', dateSurvenance: 'nope' })).toBe('date_invalide')
    expect(validateIncidentInput({ intitule: 'X', dateDetection: 'nope' })).toBe('date_invalide')
    expect(validateIncidentInput({ intitule: 'X', dateSurvenance: '2026-07-01' })).toBeNull()
  })
  it('la détection ne peut précéder la survenance', () => {
    expect(validateIncidentInput({ intitule: 'X', dateSurvenance: '2026-07-10', dateDetection: '2026-07-01' }))
      .toBe('detection_avant_survenance')
    expect(validateIncidentInput({ intitule: 'X', dateSurvenance: '2026-07-01', dateDetection: '2026-07-10' })).toBeNull()
    // même jour : accepté
    expect(validateIncidentInput({ intitule: 'X', dateSurvenance: '2026-07-01', dateDetection: '2026-07-01' })).toBeNull()
  })
  it('impact borné 1-4', () => {
    expect(validateIncidentInput({ intitule: 'X', impactEstime: 0 })).toBe('impact_invalide')
    expect(validateIncidentInput({ intitule: 'X', impactEstime: 5 })).toBe('impact_invalide')
    expect(validateIncidentInput({ intitule: 'X', impactEstime: 2 })).toBeNull()
  })
  it('montants négatifs refusés', () => {
    expect(validateIncidentInput({ intitule: 'X', montantBrut: -1 })).toBe('montant_invalide')
    expect(validateIncidentInput({ intitule: 'X', recuperations: -5 })).toBe('montant_invalide')
    expect(validateIncidentInput({ intitule: 'X', montantBrut: 'abc' })).toBe('montant_invalide')
  })
  it('récupérations supérieures au brut refusées', () => {
    expect(validateIncidentInput({ intitule: 'X', montantBrut: 100, recuperations: 150 })).toBe('recuperations_superieures')
    expect(validateIncidentInput({ intitule: 'X', montantBrut: 100, recuperations: 100 })).toBeNull()
  })
  it('statut inconnu refusé', () => {
    expect(validateIncidentInput({ intitule: 'X', statut: 'BOGUS' })).toBe('statut_invalide')
    expect(validateIncidentInput({ intitule: 'X', statut: 'QUALIFIE' })).toBeNull()
  })
})

describe('cleanIncidentInput', () => {
  it('normalise et applique les défauts', () => {
    const c = cleanIncidentInput({
      intitule: '  Fuite de données  ', description: '  ', taxonomieCode: 'BALE_2',
      montantBrut: '1234,56', recuperations: 200, impactEstime: '3', statut: 'BOGUS',
    })
    expect(c.intitule).toBe('Fuite de données')
    expect(c.description).toBeNull()
    expect(c.taxonomieCode).toBe('BALE_2')
    expect(c.montantBrut).toBe(1234.56)   // virgule décimale acceptée
    expect(c.recuperations).toBe(200)
    expect(c.impactEstime).toBe(3)
    expect(c.statut).toBe('DECLARE')      // statut inconnu → défaut
  })
  it('borne l\'impact hors échelle', () => {
    expect(cleanIncidentInput({ intitule: 'X', impactEstime: 99 }).impactEstime).toBe(4)
    expect(cleanIncidentInput({ intitule: 'X', impactEstime: -3 }).impactEstime).toBe(1)
  })
  it('champs vides → null', () => {
    const c = cleanIncidentInput({ intitule: 'X', montantBrut: '', dateSurvenance: '', riskItemId: '' })
    expect(c.montantBrut).toBeNull()
    expect(c.dateSurvenance).toBeNull()
    expect(c.riskItemId).toBeNull()
  })
})

describe('perteNette', () => {
  it('brut − récupérations, jamais négative', () => {
    expect(perteNette(1000, 300)).toBe(700)
    expect(perteNette(1000, null)).toBe(1000)
    expect(perteNette(1000, 1000)).toBe(0)
    expect(perteNette(100, 250)).toBe(0)     // garde-fou
  })
  it('null si aucune perte brute (incident compté en fréquence seule)', () => {
    expect(perteNette(null, 100)).toBeNull()
  })
  it('arrondi au centime', () => {
    expect(perteNette(10.555, 0.005)).toBe(10.55)
  })
})

describe('delaiDetection', () => {
  it('en jours, borné à 0', () => {
    expect(delaiDetection('2026-07-01', '2026-07-11')).toBe(10)
    expect(delaiDetection('2026-07-01', '2026-07-01')).toBe(0)
    expect(delaiDetection('2026-07-11', '2026-07-01')).toBe(0)
  })
  it('null si une date manque', () => {
    expect(delaiDetection(null, '2026-07-01')).toBeNull()
    expect(delaiDetection('2026-07-01', null)).toBeNull()
  })
})

describe('cycle de vie', () => {
  it('statuts terminaux', () => {
    expect(estTerminal('CLOTURE')).toBe(true)
    expect(estTerminal('REJETE')).toBe(true)
    expect(estTerminal('DECLARE')).toBe(false)
    expect(estTerminal('QUALIFIE')).toBe(false)
  })
  it('transitions autorisées', () => {
    expect(transitionAutorisee('DECLARE', 'QUALIFIE')).toBe(true)
    expect(transitionAutorisee('DECLARE', 'REJETE')).toBe(true)
    expect(transitionAutorisee('DECLARE', 'CLOTURE')).toBe(false) // pas de raccourci
    expect(transitionAutorisee('QUALIFIE', 'CLOTURE')).toBe(true)
    expect(transitionAutorisee('CLOTURE', 'DECLARE')).toBe(false) // terminal
    expect(transitionAutorisee('REJETE', 'QUALIFIE')).toBe(false)
    expect(transitionAutorisee('QUALIFIE', 'QUALIFIE')).toBe(true) // édition sur place
  })
  it('qualification exige une taxonomie', () => {
    expect(qualificationComplete({ taxonomieCode: 'BALE_2' })).toBe(true)
    expect(qualificationComplete({ taxonomieCode: null })).toBe(false)
  })
  it('quatre statuts', () => {
    expect([...INCIDENT_STATUTS]).toEqual(['DECLARE', 'QUALIFIE', 'CLOTURE', 'REJETE'])
  })
})

describe('suggestCalibration', () => {
  const inc = (riskItemId: string | null, brut: number | null = null, recup: number | null = null) =>
    ({ riskItemId, dateSurvenance: '2026-07-01', montantBrut: brut, recuperations: recup })

  it('aucun incident lié → aucune suggestion', () => {
    expect(suggestCalibration([inc('autre')], 'r1')).toEqual({ occurrences: 0, perteNetteTotale: 0, vraisemblanceSuggeree: null })
  })
  it('barème de fréquence annualisé sur 12 mois', () => {
    const n = (k: number) => Array.from({ length: k }, () => inc('r1'))
    expect(suggestCalibration(n(1), 'r1').vraisemblanceSuggeree).toBe(2)   // 1/an
    expect(suggestCalibration(n(3), 'r1').vraisemblanceSuggeree).toBe(3)   // 2-3/an
    expect(suggestCalibration(n(5), 'r1').vraisemblanceSuggeree).toBe(4)   // 4-11/an
    expect(suggestCalibration(n(12), 'r1').vraisemblanceSuggeree).toBe(5)  // ≥12/an
  })
  it('fenêtre plus courte annualise la fréquence', () => {
    // 1 incident sur 3 mois = 4/an → 4
    expect(suggestCalibration([inc('r1')], 'r1', 3).vraisemblanceSuggeree).toBe(4)
  })
  it('cumule les pertes nettes des incidents liés', () => {
    const r = suggestCalibration([inc('r1', 1000, 200), inc('r1', 500, null), inc('autre', 9999)], 'r1')
    expect(r.occurrences).toBe(2)
    expect(r.perteNetteTotale).toBe(1300)
  })
})

describe('promotion en risque du registre', () => {
  const base = {
    id: 'i1', intitule: 'Virement frauduleux', description: 'exfiltration RIB',
    taxonomieCode: 'BALE_2', processusId: 'p1', entite: 'DAF',
    impactEstime: 3, montantBrut: 25000, recuperations: 9000, riskItemId: null,
  }
  it('promouvable seulement si orphelin', () => {
    expect(estPromouvable({ riskItemId: null })).toBe(true)
    expect(estPromouvable({ riskItemId: 'r1' })).toBe(false)
  })
  it('recopie la maille et trace la provenance', () => {
    const r = promoteToRisk(base)
    expect(r).toMatchObject({
      intitule: 'Virement frauduleux', description: 'exfiltration RIB',
      taxonomieCode: 'BALE_2', processusId: 'p1', entite: 'DAF',
      statut: 'EVALUE', provenance: 'INCIDENT', sourceType: 'incident', sourceId: 'i1',
    })
  })
  it('impact ressenti → gravité résiduelle, vraisemblance à 1 (une occurrence connue)', () => {
    expect(promoteToRisk(base).graviteResiduelle).toBe(3)
    expect(promoteToRisk(base).vraisemblanceResiduelle).toBe(1)
  })
  it('sans impact renseigné, la gravité reste nulle', () => {
    expect(promoteToRisk({ ...base, impactEstime: null }).graviteResiduelle).toBeNull()
  })
})

// ─── Horodatages du workflow de déclaration DORA (art. 19) ────────────────────
describe('incident — dates du workflow DORA', () => {
  it('valide et parse les horodatages de phase', () => {
    const body = { intitule: 'Incident', doraClasseMajeurLe: '2026-03-01T08:00:00Z', doraInitialeSoumiseLe: '2026-03-01T10:00:00Z' }
    expect(validateIncidentInput(body)).toBe(null)
    const c = cleanIncidentInput(body)
    expect(c.doraClasseMajeurLe).toEqual(new Date('2026-03-01T08:00:00Z'))
    expect(c.doraInitialeSoumiseLe).toEqual(new Date('2026-03-01T10:00:00Z'))
    expect(c.doraFinaleSoumiseLe).toBe(null) // absent → null
  })
  it('rejette un horodatage de phase invalide', () => {
    expect(validateIncidentInput({ intitule: 'X', doraFinaleSoumiseLe: 'pas-une-date' })).toBe('date_invalide')
  })
})
