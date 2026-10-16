// Filtres « façon tableur » des listes paginées côté serveur (lot V1) : URL ↔ clés ↔ libellés.
import { describe, it, expect } from 'vitest'
import { lireFiltreColonne, ecrireFiltreColonne, lireFiltresColonnes, clesDistinctes, libellesColonne, libellesDepuisCles, clesDepuisLibelles, MAX_VALEURS_FILTRE } from '@/lib/liste-colonnes'

describe('liste-colonnes', () => {
  it('aller-retour URL : JSON de clés ; absent ou illisible = pas de filtre ; ensemble vide conservé', () => {
    expect(lireFiltreColonne(ecrireFiltreColonne(['A, B', 'C']))).toEqual(new Set(['A, B', 'C']))
    expect(lireFiltreColonne(ecrireFiltreColonne([]))).toEqual(new Set())
    expect(ecrireFiltreColonne(null)).toBeNull()
    expect(lireFiltreColonne(null)).toBeNull()
    expect(lireFiltreColonne('pas du json')).toBeNull()
    expect(lireFiltreColonne('{"a":1}')).toBeNull()
    expect(lireFiltreColonne(JSON.stringify(['x', 3]))).toEqual(new Set(['x']))
    expect(lireFiltreColonne(JSON.stringify(Array.from({ length: 900 }, (_, i) => `v${i}`)))!.size).toBe(MAX_VALEURS_FILTRE)
  })
  it('lit seulement les colonnes prévues (préfixe col_)', () => {
    const sp = new URLSearchParams({ col_statut: '["OUVERT"]', col_autre: '["x"]', statut: 'X' })
    expect(lireFiltresColonnes(sp, ['statut', 'category'])).toEqual({ statut: new Set(['OUVERT']) })
  })
  it('clés distinctes : valeur absente comprise, triées', () => {
    expect(clesDistinctes([{ k: 'b' }, { k: '' }, { k: 'a' }, { k: 'b' }], r => r.k)).toEqual(['', 'a', 'b'])
  })
  it('libellés ↔ clés : un libellé vide n’est pas proposé ; un libellé partagé couvre ses clés', () => {
    const lib = (c: string) => ({ '': '—', X1: 'Fraude', X2: 'Fraude', Y: 'Panne' } as Record<string, string>)[c] ?? c
    expect(libellesColonne(['', 'X1', 'X2', 'Y'], lib)).toEqual(['—', 'Fraude', 'Panne'])
    expect(libellesColonne(['', 'P'], c => c)).toEqual(['P'])
    expect(clesDepuisLibelles(['', 'X1', 'X2', 'Y'], lib, new Set(['Fraude', '—']))).toEqual(['', 'X1', 'X2'])
    expect(clesDepuisLibelles(['Y'], lib, undefined)).toBeNull()
    expect(libellesDepuisCles(new Set(['X1', 'Y']), lib)).toEqual(new Set(['Fraude', 'Panne']))
    expect(libellesDepuisCles(null, lib)).toBeUndefined()
  })
})
