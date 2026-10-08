import { describe, it, expect } from 'vitest'
import {
  TYPES_ENTITE, normaliserNom, nettoyerEntite, creeraitUnCycle, estActive, correspondances,
  champsVerrouilles, construireArbre, sourceVeriteDe, dateLimiteHistorique, RETENTION_HISTORIQUE_ANS,
  type EntiteRef,
} from '@/lib/entites'

const e = (id: string, nom: string, extra: Partial<EntiteRef> = {}): EntiteRef => ({ id, nom, type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null, ...extra })

describe('normaliserNom', () => {
  it('ignore casse, accents, ponctuation et espaces multiples', () => {
    expect(normaliserNom('  Direction   des Systèmes d’Information ')).toBe('direction des systemes d information')
    expect(normaliserNom('D.S.I.')).toBe('d s i')
  })
})

describe('nettoyerEntite', () => {
  it('accepte une entité valide et nettoie alias et code', () => {
    const r = nettoyerEntite({ nom: ' DSI ', type: 'SERVICE', alias: ['Direction SI', ' ', 'direction si', 'DSI'], codeExterne: '  RH-042 ' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.entite.nom).toBe('DSI')
      expect(r.entite.alias).toEqual(['Direction SI']) // vides, doublons et nom lui-même retirés
      expect(r.entite.codeExterne).toBe('RH-042')
    }
  })
  it('refuse un nom vide, un type inconnu, une clôture avant le début', () => {
    expect(nettoyerEntite({ nom: '', type: 'SERVICE' })).toEqual({ ok: false, error: 'nom_requis' })
    expect(nettoyerEntite({ nom: 'X', type: 'PLANETE' })).toEqual({ ok: false, error: 'type_invalide' })
    expect(nettoyerEntite({ nom: 'X', type: 'SITE', valideDu: '2026-05-01', valideAu: '2026-01-01' })).toEqual({ ok: false, error: 'dates_invalides' })
  })
  it('les types couvrent filiale et service (décisions du 2026-10-08)', () => {
    expect(TYPES_ENTITE).toEqual(expect.arrayContaining(['FILIALE', 'DIRECTION', 'SITE', 'SERVICE']))
  })
  it('en mise à jour partielle, ne renvoie que les champs fournis', () => {
    const r = nettoyerEntite({ alias: ['A'] }, { partiel: true })
    expect(r).toEqual({ ok: true, entite: { alias: ['A'] } })
  })
})

describe('creeraitUnCycle', () => {
  const liste = [e('a', 'A'), e('b', 'B', { parentId: 'a' }), e('c', 'C', { parentId: 'b' })]
  it('détecte un rattachement à soi-même ou à un descendant', () => {
    expect(creeraitUnCycle(liste, 'a', 'a')).toBe(true)
    expect(creeraitUnCycle(liste, 'a', 'c')).toBe(true)
  })
  it('accepte un rattachement sans boucle', () => {
    expect(creeraitUnCycle(liste, 'c', 'a')).toBe(false)
    expect(creeraitUnCycle(liste, 'b', null)).toBe(false)
  })
})

describe('estActive', () => {
  it('une entité close à une date passée ne l’est plus', () => {
    const ref = new Date('2026-10-08')
    expect(estActive(e('a', 'A'), ref)).toBe(true)
    expect(estActive(e('a', 'A', { valideAu: new Date('2026-01-01') }), ref)).toBe(false)
    expect(estActive(e('a', 'A', { valideAu: new Date('2027-01-01') }), ref)).toBe(true)
  })
})

describe('correspondances', () => {
  const liste = [
    e('dsi', 'Direction des systèmes d’information', { alias: ['DSI'], codeExterne: 'D100' }),
    e('rh', 'Ressources humaines', { alias: ['DRH'] }),
    e('ach', 'Achats'),
  ]
  it('rapproche par nom, alias ou code, exact après normalisation', () => {
    expect(correspondances('dsi', liste)[0]).toMatchObject({ id: 'dsi', score: 1, motif: 'ALIAS' })
    expect(correspondances('D100', liste)[0]).toMatchObject({ id: 'dsi', motif: 'CODE' })
    expect(correspondances('ressources  humaines', liste)[0]).toMatchObject({ id: 'rh', motif: 'NOM' })
  })
  it('propose les noms proches (faute de frappe) avec un score < 1', () => {
    const [m] = correspondances('Ressource humaine', liste)
    expect(m.id).toBe('rh')
    expect(m.score).toBeLessThan(1)
    expect(m.score).toBeGreaterThan(0.7)
  })
  it('ne propose rien pour un texte sans rapport', () => {
    expect(correspondances('Logistique Asie', liste)).toEqual([])
  })
})

describe('champsVerrouilles', () => {
  it('annuaire source de vérité : nom, code et rattachement verrouillés pour les entités venues de l’annuaire', () => {
    expect(champsVerrouilles(e('a', 'A', { source: 'ANNUAIRE' }), 'ANNUAIRE')).toEqual(['nom', 'codeExterne', 'parentId'])
  })
  it('ACRA source de vérité, ou entité saisie à la main : rien de verrouillé', () => {
    expect(champsVerrouilles(e('a', 'A', { source: 'ANNUAIRE' }), 'ACRA')).toEqual([])
    expect(champsVerrouilles(e('a', 'A', { source: 'MANUEL' }), 'ANNUAIRE')).toEqual([])
  })
})

describe('sourceVeriteDe', () => {
  it('lit le choix dans la configuration du connecteur, ACRA par défaut', () => {
    expect(sourceVeriteDe({ type: 'LDAP', sourceVerite: 'ANNUAIRE' })).toBe('ANNUAIRE')
    expect(sourceVeriteDe({ sourceVerite: 'n importe quoi' })).toBe('ACRA')
    expect(sourceVeriteDe(null)).toBe('ACRA')
  })
})

describe('construireArbre', () => {
  it('range les enfants sous leur parent, par nom, et remonte les orphelins à la racine', () => {
    const arbre = construireArbre([e('b', 'Beta', { parentId: 'a' }), e('a', 'Alpha'), e('o', 'Orphelin', { parentId: 'disparu' }), e('c', 'Alef', { parentId: 'a' })])
    expect(arbre.map(n => n.entite.id)).toEqual(['a', 'o'])
    expect(arbre[0].enfants.map(n => n.entite.id)).toEqual(['c', 'b'])
  })
})

describe('rétention de l’historique', () => {
  it('5 ans (décision du 2026-10-08)', () => {
    expect(RETENTION_HISTORIQUE_ANS).toBe(5)
    expect(dateLimiteHistorique(new Date('2026-10-08T00:00:00Z')).toISOString().slice(0, 10)).toBe('2021-10-08')
  })
})
