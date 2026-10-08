import { describe, it, expect } from 'vitest'
import { mapEntiteColumns, lireType, planifierImportEntites, type LigneImportEntite } from '@/lib/entites-import'
import type { EntiteRef } from '@/lib/entites'

const E = (id: string, nom: string, o: Partial<EntiteRef> = {}): EntiteRef => ({ id, nom, type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, source: 'IMPORT', valideAu: null, ...o })
const L = (line: number, nom: string, o: Partial<LigneImportEntite> = {}): LigneImportEntite => ({ line, nom, ...o })

describe('mapEntiteColumns / lireType', () => {
  it('reconnaît les colonnes usuelles (fr / en)', () => {
    expect(mapEntiteColumns(['Code', 'Nom', 'Type', 'Parent', 'Alias'])).toEqual({ code: 'Code', nom: 'Nom', type: 'Type', parent: 'Parent', alias: 'Alias' })
    expect(mapEntiteColumns(['Entity name', 'External ID', 'Parent code'])).toMatchObject({ nom: 'Entity name', code: 'External ID', parent: 'Parent code' })
  })
  it('traduit un libellé de type, sinon le type par défaut', () => {
    expect(lireType('Filiale', 'AUTRE')).toBe('FILIALE')
    expect(lireType('subsidiary', 'AUTRE')).toBe('FILIALE')
    expect(lireType('Service', 'AUTRE')).toBe('SERVICE')
    expect(lireType('Département', 'SITE')).toBe('DIRECTION')
    expect(lireType('', 'SERVICE')).toBe('SERVICE')
    expect(lireType('planète', 'SERVICE')).toBe('SERVICE')
  })
})

describe('planifierImportEntites', () => {
  const existantes = [
    E('dsi', 'Direction SI', { codeExterne: 'D100', source: 'ANNUAIRE' }),
    E('rh', 'Ressources humaines', { alias: ['DRH'] }),
    E('old', 'Site Lyon', { codeExterne: 'S9' }),
    E('man', 'Saisie manuelle', { source: 'MANUEL' }),
  ]

  it('classe : nouvelle, renommée (même code), inchangée (nom ou alias), doublon probable', () => {
    const p = planifierImportEntites([
      L(2, 'Direction des systèmes d’information', { code: 'D100' }),
      L(3, 'DRH'),
      L(4, 'Achats'),
      L(5, 'Ressource humaine'),
    ], existantes, { typeParDefaut: 'DIRECTION' })
    const st = Object.fromEntries(p.lignes.map(l => [l.line, l.statut]))
    expect(st).toEqual({ 2: 'RENOMMEE', 3: 'INCHANGEE', 4: 'NOUVELLE', 5: 'DOUBLON_PROBABLE' })
    expect(p.lignes.find(l => l.line === 2)).toMatchObject({ entiteId: 'dsi', ancienNom: 'Direction SI' })
    expect(p.lignes.find(l => l.line === 5)).toMatchObject({ entiteId: 'rh' })
    expect(p.aCreer.map(l => l.line)).toEqual([4]) // le doublon n'est créé que sur confirmation
    expect(p.aRenommer).toEqual([{ id: 'dsi', nom: 'Direction des systèmes d’information', ancienNom: 'Direction SI' }])
  })

  it('doublon confirmé → créé ; renommage décoché → non appliqué', () => {
    const p = planifierImportEntites([L(2, 'Ressource humaine'), L(3, 'Nouveau nom', { code: 'D100' })], existantes, { typeParDefaut: 'DIRECTION', creerQuandMeme: [2], renommer: [] })
    expect(p.aCreer.map(l => l.line)).toEqual([2])
    expect(p.aRenommer).toEqual([])
  })

  it('disparues : seulement si la liste est complète, parmi les entités importées encore actives (jamais les saisies manuelles)', () => {
    const lignes = [L(2, 'Direction SI', { code: 'D100' })]
    expect(planifierImportEntites(lignes, existantes, { typeParDefaut: 'DIRECTION' }).disparues).toEqual([])
    const p = planifierImportEntites(lignes, existantes, { typeParDefaut: 'DIRECTION', listeComplete: true })
    expect(p.disparues.map(d => d.id).sort()).toEqual(['old', 'rh'])
    expect(p.aClore).toEqual([]) // proposée, jamais automatique
    expect(planifierImportEntites(lignes, existantes, { typeParDefaut: 'DIRECTION', listeComplete: true, clore: ['old', 'man'] }).aClore).toEqual(['old'])
  })

  it('rattachement : parent du fichier (par code ou nom) créé avant l’enfant, ou parent existant', () => {
    const p = planifierImportEntites([
      L(2, 'Agence Nord', { parent: 'G1' }),
      L(3, 'Groupe', { code: 'G1', type: 'Filiale' }),
      L(4, 'Paie', { parent: 'Ressources humaines' }),
    ], existantes, { typeParDefaut: 'SERVICE' })
    expect(p.aCreer.map(l => l.line)).toEqual([3, 2, 4])
    expect(p.lignes.find(l => l.line === 2)).toMatchObject({ parentLigne: 3, type: 'SERVICE' })
    expect(p.lignes.find(l => l.line === 3)).toMatchObject({ type: 'FILIALE' })
    expect(p.lignes.find(l => l.line === 4)).toMatchObject({ parentExistantId: 'rh' })
  })

  it('rejets expliqués : nom manquant, code en double, parent inconnu, boucle, parent rejeté', () => {
    const p = planifierImportEntites([
      L(2, ''),
      L(3, 'A', { code: 'X' }), L(4, 'B', { code: 'X' }),
      L(5, 'C', { parent: 'Inconnu' }),
      L(6, 'D', { code: 'd', parent: 'e' }), L(7, 'E', { code: 'e', parent: 'd' }),
      L(8, 'F', { parent: 'C' }),
    ], existantes, { typeParDefaut: 'DIRECTION' })
    const r = Object.fromEntries(p.lignes.map(l => [l.line, l.raison ?? l.statut]))
    expect(r).toEqual({ 2: 'nom_requis', 3: 'NOUVELLE', 4: 'code_en_double', 5: 'parent_inconnu', 6: 'boucle', 7: 'boucle', 8: 'parent_rejete' })
    expect(p.compte).toMatchObject({ NOUVELLE: 1, REJETEE: 6 })
  })

  it('deux lignes du fichier au même nom sans code : la seconde est un doublon probable de la première', () => {
    const p = planifierImportEntites([L(2, 'Achats'), L(3, 'achats')], [], { typeParDefaut: 'DIRECTION' })
    expect(p.lignes.map(l => l.statut)).toEqual(['NOUVELLE', 'DOUBLON_PROBABLE'])
    expect(p.lignes[1]).toMatchObject({ doublonDeLigne: 2 })
  })
})
