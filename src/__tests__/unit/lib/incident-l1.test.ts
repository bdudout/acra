/** Incident L1 : type d'événement, quasi-incident, attributs de régime, pertes multi-composantes. */
import { describe, expect, it } from 'vitest'
import { validateIncidentInput, cleanIncidentInput } from '@/lib/incident'
import { resolveIncidentsConfig } from '@/lib/incidents-config'
import { sanitizeAttributs } from '@/lib/notification-regimes'

const cfg = resolveIncidentsConfig({ deviseReference: 'EUR', taux: { USD: 0.5 }, typesEvenement: [{ code: 'FRAUDE', actif: false }] })

describe('attributs de régime', () => {
  it('ne garde que les booléens connus et des codes de régime valides (bornés)', () => {
    expect(sanitizeAttributs({ significatif: true, donneesPersonnelles: 'oui', contractuel: false, regimes: ['NIS2', 'bad code', 'X'], junk: 1 }))
      .toEqual({ significatif: true, regimes: ['NIS2', 'X'] })
    expect(sanitizeAttributs(null)).toEqual({})
  })
})

describe('cleanIncidentInput — champs L1', () => {
  it('sans nouveaux champs : comportement historique inchangé (montants saisis conservés)', () => {
    const c = cleanIncidentInput({ intitule: 'X', montantBrut: 1000, recuperations: 200 })
    expect([c.montantBrut, c.recuperations, c.pertes, c.quasiIncident, c.typeEvenement, c.attributs]).toEqual([1000, 200, [], false, null, {}])
  })
  it('lignes de perte : agrégats = somme convertie, montants saisis ignorés', () => {
    const c = cleanIncidentInput({
      intitule: 'X', montantBrut: 1, recuperations: 1,
      pertes: [{ type: 'PERTE_DIRECTE', montant: 1000 }, { type: 'PENALITE', montant: 400, devise: 'USD' }],
      recuperationsLignes: [{ type: 'ASSURANCE', montant: 300 }],
    }, cfg)
    expect([c.montantBrut, c.recuperations]).toEqual([1200, 300])
    expect(c.pertes).toHaveLength(2)
    expect(c.recuperationsLignes).toEqual([{ type: 'ASSURANCE', montant: 300, devise: 'EUR' }])
  })
  it('quasi-incident : aucune perte réalisée, montants nuls', () => {
    const c = cleanIncidentInput({ intitule: 'X', quasiIncident: true, pertes: [{ type: 'AUTRE', montant: 50 }], montantBrut: 50 }, cfg)
    expect([c.quasiIncident, c.pertes, c.montantBrut, c.recuperations]).toEqual([true, [], null, null])
  })
  it('type d’événement, attributs et date de règlement', () => {
    const c = cleanIncidentInput({ intitule: 'X', typeEvenement: 'CYBER', attributs: { significatif: true }, dateReglement: '2026-10-01' }, cfg)
    expect([c.typeEvenement, c.attributs, c.dateReglement?.toISOString()]).toEqual(['CYBER', { significatif: true }, '2026-10-01T00:00:00.000Z'])
  })
})

describe('validateIncidentInput — champs L1', () => {
  it('type d’événement : doit être actif dans le catalogue de l’organisation', () => {
    expect(validateIncidentInput({ intitule: 'X', typeEvenement: 'CYBER' }, cfg)).toBeNull()
    expect(validateIncidentInput({ intitule: 'X', typeEvenement: 'FRAUDE' }, cfg)).toBe('type_evenement_invalide')
    expect(validateIncidentInput({ intitule: 'X', typeEvenement: 'INCONNU' }, cfg)).toBe('type_evenement_invalide')
    expect(validateIncidentInput({ intitule: 'X', typeEvenement: '' }, cfg)).toBeNull()
  })
  it('récupérations supérieures à la perte brute refusées sur les lignes aussi', () => {
    expect(validateIncidentInput({ intitule: 'X', pertes: [{ type: 'AUTRE', montant: 100 }], recuperationsLignes: [{ type: 'TIERS', montant: 150 }] }, cfg)).toBe('recuperations_superieures')
    expect(validateIncidentInput({ intitule: 'X', pertes: [{ type: 'AUTRE', montant: 100 }], recuperationsLignes: [{ type: 'TIERS', montant: 50 }] }, cfg)).toBeNull()
  })
  it('date de règlement invalide refusée ; ne peut précéder la survenance', () => {
    expect(validateIncidentInput({ intitule: 'X', dateReglement: 'nope' }, cfg)).toBe('date_invalide')
    expect(validateIncidentInput({ intitule: 'X', dateSurvenance: '2026-07-10', dateReglement: '2026-07-01' }, cfg)).toBe('reglement_avant_survenance')
  })
})
