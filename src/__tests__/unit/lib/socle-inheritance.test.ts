/**
 * socle-inheritance.test.ts
 *
 * Tests de la logique d'héritage de socle EBIOS RM.
 *
 * La règle métier :
 *  - Cadrage copié    : perimetre, objectifsEtude, missions, valeursMetier, biensSupports
 *  - Cadrage NON copié: eventsRedoutes, socleSécurité (contexte-dépendants)
 *  - SourcesRisque    : toutes copiées, id/analyseId/timestamps réinitialisés
 */

import { describe, it, expect } from 'vitest'

// ── Helpers purs extraits de la logique POST /api/analyses ───────────────────

/**
 * Construit les données de cadrage à créer depuis un socle.
 * Reproduit la logique de `route.ts` POST — à garder en sync.
 */
function buildCadrageFromSocle(socleData: {
  cadrage?: {
    perimetre?: string | null
    objectifsEtude?: string | null
    missions?: unknown
    valeursMetier?: unknown
    biensSupports?: unknown
    // Champs volontairement exclus de l'héritage
    eventsRedoutes?: unknown
    socleSécurité?: unknown
  } | null
}): Record<string, unknown> {
  if (!socleData.cadrage) return {}
  const { cadrage } = socleData
  return {
    perimetre:      cadrage.perimetre,
    objectifsEtude: cadrage.objectifsEtude,
    missions:       cadrage.missions,
    valeursMetier:  cadrage.valeursMetier,
    biensSupports:  cadrage.biensSupports,
  }
}

/**
 * Mappe les sources de risque du socle vers un tableau de création
 * (sans id, analyseId, timestamps).
 * Reproduit la logique de `route.ts` POST.
 */
function mapSocleSourcesRisque(
  sourcesRisque: Array<{ id: string; analyseId: string; createdAt: Date; updatedAt: Date; [key: string]: unknown }>,
  newAnalyseId: string,
): Array<Record<string, unknown>> {
  return sourcesRisque.map(sr => {
    const { id: _id, analyseId: _aid, createdAt: _ca, updatedAt: _ua, ...rest } = sr
    return { ...rest, analyseId: newAnalyseId }
  })
}

// ── Tests buildCadrageFromSocle ───────────────────────────────────────────────

describe('buildCadrageFromSocle', () => {
  it('retourne {} si cadrage est null', () => {
    expect(buildCadrageFromSocle({ cadrage: null })).toEqual({})
  })

  it('retourne {} si cadrage est undefined', () => {
    expect(buildCadrageFromSocle({})).toEqual({})
  })

  it('copie les 5 champs autorisés du cadrage', () => {
    const cadrage = {
      perimetre:      'Système d\'information RH',
      objectifsEtude: 'Protéger les données personnelles',
      missions:       ['Paie', 'Recrutement'],
      valeursMetier:  [{ nom: 'Données RH', criticiteDIC: 3 }],
      biensSupports:  [{ nom: 'Serveur RH', categorie: 'APPLICATION' }],
    }
    const result = buildCadrageFromSocle({ cadrage })
    expect(result).toEqual(cadrage)
    expect(Object.keys(result)).toHaveLength(5)
  })

  it('N\'hérite PAS des events redoutés ni du socle de sécurité', () => {
    const cadrage = {
      perimetre:      'Périmètre',
      objectifsEtude: 'Objectifs',
      missions:       [],
      valeursMetier:  [],
      biensSupports:  [],
      eventsRedoutes: [{ id: 'er1', nom: 'Vol de données' }], // doit être exclu
      socleSécurité:  [{ mesure: 'Chiffrement' }],            // doit être exclu
    }
    const result = buildCadrageFromSocle({ cadrage })
    expect(result).not.toHaveProperty('eventsRedoutes')
    expect(result).not.toHaveProperty('socleSécurité')
  })

  it('préserve les valeurs null/undefined des champs copiés', () => {
    const cadrage = {
      perimetre:      null,
      objectifsEtude: undefined,
      missions:       [],
      valeursMetier:  [],
      biensSupports:  [],
    }
    const result = buildCadrageFromSocle({ cadrage })
    expect(result.perimetre).toBeNull()
    expect(result.objectifsEtude).toBeUndefined()
  })
})

// ── Tests mapSocleSourcesRisque ───────────────────────────────────────────────

describe('mapSocleSourcesRisque', () => {
  const now = new Date()
  const mockSR = (overrides = {}) => ({
    id:         'sr-original-id',
    analyseId:  'socle-analyse-id',
    createdAt:  now,
    updatedAt:  now,
    nom:        'Source de risque test',
    type:       'HUMAIN',
    motivation: 'Gain financier',
    ...overrides,
  })

  it('supprime id, createdAt et updatedAt — remplace analyseId', () => {
    const result = mapSocleSourcesRisque([mockSR()], 'new-analyse-id')
    // L'id du socle source doit disparaître
    expect(result[0]).not.toHaveProperty('id')
    // Les timestamps du socle doivent disparaître
    expect(result[0]).not.toHaveProperty('createdAt')
    expect(result[0]).not.toHaveProperty('updatedAt')
    // analyseId est bien présent mais pointe sur la nouvelle analyse
    expect(result[0].analyseId).toBe('new-analyse-id')
  })

  it('remplace analyseId par le nouvel ID', () => {
    const result = mapSocleSourcesRisque([mockSR()], 'new-analyse-id')
    expect(result[0].analyseId).toBe('new-analyse-id')
  })

  it('conserve tous les champs métier', () => {
    const result = mapSocleSourcesRisque([mockSR()], 'new-analyse-id')
    expect(result[0].nom).toBe('Source de risque test')
    expect(result[0].type).toBe('HUMAIN')
    expect(result[0].motivation).toBe('Gain financier')
  })

  it('traite plusieurs sources', () => {
    const sources = [mockSR({ nom: 'SR1' }), mockSR({ nom: 'SR2', id: 'sr-2' })]
    const result = mapSocleSourcesRisque(sources, 'new-id')
    expect(result).toHaveLength(2)
    expect(result[0].nom).toBe('SR1')
    expect(result[1].nom).toBe('SR2')
    result.forEach(r => {
      expect(r.analyseId).toBe('new-id')
      expect(r).not.toHaveProperty('id')
    })
  })

  it('retourne [] si pas de sources', () => {
    expect(mapSocleSourcesRisque([], 'new-id')).toEqual([])
  })
})
