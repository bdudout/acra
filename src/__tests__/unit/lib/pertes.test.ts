/** Pertes multi-composantes : lignes typées, devises, seuils (collecte / grande perte). */
import { describe, expect, it } from 'vitest'
import {
  TYPES_PERTE, TYPES_RECUPERATION, sanitizePertes, sanitizeRecuperations, totauxPertes, evaluerSeuils, pertesParType,
} from '@/lib/pertes'

const cfg = { deviseReference: 'EUR', taux: { USD: 0.5 } as Record<string, number> }

describe('catalogues par défaut', () => {
  it('types de perte et de récupération livrés', () => {
    expect(TYPES_PERTE).toEqual(['PERTE_DIRECTE', 'PROVISION', 'REPARATION', 'PENALITE', 'MANQUE_A_GAGNER', 'AUTRE'])
    expect(TYPES_RECUPERATION).toEqual(['ASSURANCE', 'TIERS', 'CLIENT', 'AUTRE'])
  })
})

describe('sanitizePertes / sanitizeRecuperations', () => {
  it('normalise les lignes : type par défaut, devise par défaut, montants bornés et arrondis', () => {
    const l = sanitizePertes([
      { type: 'PENALITE', montant: 1234.567, devise: 'usd', date: '2026-09-01', statut: 'COMPTABILISE' },
      { type: 'nimporte quoi!', montant: 10 },
      { type: 'AUTRE', montant: -5 },
      { type: 'AUTRE', montant: 'abc' },
      null,
    ], 'EUR')
    expect(l).toEqual([
      { type: 'PENALITE', montant: 1234.57, devise: 'USD', date: '2026-09-01T00:00:00.000Z', statut: 'COMPTABILISE' },
      { type: 'AUTRE', montant: 10, devise: 'EUR', statut: 'ESTIME' },
    ])
  })
  it('accepte un type personnalisé au format code et borne à 50 lignes', () => {
    expect(sanitizePertes([{ type: 'JOURS_ARRET', montant: 3 }], 'EUR')[0].type).toBe('JOURS_ARRET')
    expect(sanitizePertes(Array.from({ length: 80 }, () => ({ type: 'AUTRE', montant: 1 })), 'EUR')).toHaveLength(50)
  })
  it('récupérations typées (assurance, tiers, client)', () => {
    expect(sanitizeRecuperations([{ type: 'ASSURANCE', montant: 500 }, { type: '', montant: 1 }], 'EUR')).toEqual([{ type: 'ASSURANCE', montant: 500, devise: 'EUR' }])
  })
})

describe('totauxPertes', () => {
  it('brut = somme des lignes converties, net = brut − récupérations', () => {
    const t = totauxPertes(
      [{ type: 'PERTE_DIRECTE', montant: 1000, devise: 'EUR', statut: 'ESTIME' }, { type: 'PENALITE', montant: 400, devise: 'USD', statut: 'ESTIME' }],
      [{ type: 'ASSURANCE', montant: 300, devise: 'EUR' }], cfg)
    expect(t).toEqual({ brut: 1200, recuperations: 300, net: 900, devisesSansTaux: [] })
  })
  it('une devise sans taux est exclue et signalée, jamais convertie à tort', () => {
    const t = totauxPertes([{ type: 'AUTRE', montant: 100, devise: 'CHF', statut: 'ESTIME' }, { type: 'AUTRE', montant: 50, devise: 'EUR', statut: 'ESTIME' }], [], cfg)
    expect(t.brut).toBe(50)
    expect(t.devisesSansTaux).toEqual(['CHF'])
  })
  it('sans ligne : totaux nuls (null), pas de perte inventée', () => {
    expect(totauxPertes([], [], cfg)).toEqual({ brut: null, recuperations: null, net: null, devisesSansTaux: [] })
  })
  it('net jamais négatif implicite : une récupération supérieure au brut donne un net négatif visible', () => {
    expect(totauxPertes([{ type: 'AUTRE', montant: 100, devise: 'EUR', statut: 'ESTIME' }], [{ type: 'TIERS', montant: 150, devise: 'EUR' }], cfg).net).toBe(-50)
  })
})

describe('evaluerSeuils', () => {
  it('sans seuil : tout est collecté, aucune grande perte', () => {
    expect(evaluerSeuils(500, { seuilCollecte: null, seuilGrandePerte: null })).toEqual({ collectee: true, grandePerte: false })
  })
  it('sous le seuil de collecte : non collectée ; au-dessus du seuil de grande perte : escalade', () => {
    const s = { seuilCollecte: 1000, seuilGrandePerte: 100000 }
    expect(evaluerSeuils(999, s).collectee).toBe(false)
    expect(evaluerSeuils(1000, s).collectee).toBe(true)
    expect(evaluerSeuils(100000, s).grandePerte).toBe(true)
    expect(evaluerSeuils(99999, s).grandePerte).toBe(false)
  })
  it('perte inconnue (null) : collectée par prudence, jamais grande perte', () => {
    expect(evaluerSeuils(null, { seuilCollecte: 1000, seuilGrandePerte: 5 })).toEqual({ collectee: true, grandePerte: false })
  })
})

describe('pertesParType', () => {
  it('ventile le brut converti par type de perte (reporting)', () => {
    const r = pertesParType([
      { type: 'PENALITE', montant: 400, devise: 'USD', statut: 'ESTIME' }, { type: 'PENALITE', montant: 100, devise: 'EUR', statut: 'ESTIME' }, { type: 'AUTRE', montant: 5, devise: 'EUR', statut: 'ESTIME' },
    ], cfg)
    expect(r).toEqual({ PENALITE: 300, AUTRE: 5 })
  })
})
