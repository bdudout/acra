import { describe, expect, it } from 'vitest'
import {
  canonicalRef, extractReferences, extractReferencesWithLabels, parseLevelLabel, parseSymbolLevel,
  suggestValueMap, applyValueMap, groupRows, isTemplateRow, filterRetained, normalizeRetained, aliasPrefix,
} from '@/lib/import-transforms'

describe('canonicalRef — variantes d’écriture d’une même référence (B-IMP-40)', () => {
  it.each([
    ['VM_02', 'VM2'], ['VM02', 'VM2'], ['vm-02', 'VM2'], ['VM 2', 'VM2'], ['SS-09', 'SS9'], ['SO_03a', 'SO3A'], ['SR/OV_01', 'SROV1'], ['BS_MAT.01', 'BSMAT1'], ['ER_10', 'ER10'],
  ])('%s → %s', (raw, canon) => expect(canonicalRef(raw)).toBe(canon))
  it('deux références qui ne diffèrent que par le préfixe restent distinctes', () => {
    expect(canonicalRef('R_05')).not.toBe(canonicalRef('RI_05'))
  })
})

describe('extractReferences — listes, séparateurs quelconques, plages (B-IMP-26)', () => {
  const vm = { prefixes: ['VM'] }
  it('liste séparée par virgules, espaces, lignes ou « et » ; variantes d’écriture', () => {
    expect(extractReferences('VM02, VM03, VM_04', vm).map(r => r.ref)).toEqual(['VM2', 'VM3', 'VM4'])
    expect(extractReferences('VM_01\nVM_02 et VM03; vm-04', vm).map(r => r.ref)).toEqual(['VM1', 'VM2', 'VM3', 'VM4'])
  })
  it('conserve l’écriture d’origine et ignore le reste du texte', () => {
    const r = extractReferences('voir VM02 (données) puis VM_05.', vm)
    expect(r.map(x => x.raw)).toEqual(['VM02', 'VM_05'])
  })
  it('développe les plages de même préfixe (à, -, to, au) ; dédoublonne', () => {
    const p = { prefixes: ['R'] }
    expect(extractReferences('R_01 à R_04', p).map(r => r.ref)).toEqual(['R1', 'R2', 'R3', 'R4'])
    expect(extractReferences('R_05 R_07 R_08', p).map(r => r.ref)).toEqual(['R5', 'R7', 'R8'])
    expect(extractReferences('R_01-R_03, R_02', p).map(r => r.ref)).toEqual(['R1', 'R2', 'R3'])
    expect(extractReferences('R1 to R3', p).map(r => r.ref)).toEqual(['R1', 'R2', 'R3'])
    expect(extractReferences('R_01 à R_09', p)[3]).toMatchObject({ ref: 'R4', expandedFrom: 'R_01 à R_09' })
  })
  it('plage démesurée ou inversée : non développée (bornes seules)', () => {
    expect(extractReferences('R_01 à R_9999', { prefixes: ['R'] }).map(r => r.ref)).toEqual(['R1', 'R9999'])
    expect(extractReferences('R_09 à R_01', { prefixes: ['R'] }).map(r => r.ref)).toEqual(['R9', 'R1'])
  })
  it('préfixe long non confondu avec un préfixe court (RI ≠ R)', () => {
    expect(extractReferences('RI_05, R_05', { prefixes: ['R'] }).map(r => r.raw)).toEqual(['R_05'])
    expect(extractReferences('RI_05, R_05', { prefixes: ['RI', 'R'] }).map(r => r.ref)).toEqual(['RI5', 'R5'])
  })
  it('cellule vide ou sans référence', () => {
    expect(extractReferences('', vm)).toEqual([])
    expect(extractReferences('aucune', vm)).toEqual([])
  })
})

describe('extractReferencesWithLabels — « ER03 : libellé » (B-IMP-27)', () => {
  it('sépare références et libellés libres', () => {
    const r = extractReferencesWithLabels('ER03 : Modification malveillante d’une donnée ER_07: Suppression des données ER_05', { prefixes: ['ER'] })
    expect(r).toEqual([
      { ref: 'ER3', raw: 'ER03', label: 'Modification malveillante d’une donnée' },
      { ref: 'ER7', raw: 'ER_07', label: 'Suppression des données' },
      { ref: 'ER5', raw: 'ER_05', label: '' },
    ])
  })
})

describe('niveaux : « N - libellé » et symboles (B-IMP-28/29)', () => {
  it('parseLevelLabel', () => {
    expect(parseLevelLabel('3 - Elevé')).toEqual({ level: 3, label: 'Elevé' })
    expect(parseLevelLabel('2 – Limitée')).toEqual({ level: 2, label: 'Limitée' })
    expect(parseLevelLabel(' 1 - Peu vraisemblable ')).toEqual({ level: 1, label: 'Peu vraisemblable' })
    expect(parseLevelLabel('4')).toEqual({ level: 4, label: '' })
    expect(parseLevelLabel('Elevé')).toBeNull()
    expect(parseLevelLabel('')).toBeNull()
    expect(parseLevelLabel('2026-01-01')).toBeNull()
  })
  it('parseSymbolLevel : nombre de « + » borné par l’échelle déclarée', () => {
    expect(parseSymbolLevel('+', 3)).toBe(1)
    expect(parseSymbolLevel('+ +', 3)).toBe(2)
    expect(parseSymbolLevel('+ + +', 3)).toBe(3)
    expect(parseSymbolLevel('+++', 3)).toBe(3)
    expect(parseSymbolLevel('+ + + +', 3)).toBeNull()
    expect(parseSymbolLevel('a +', 3)).toBeNull()
    expect(parseSymbolLevel('', 3)).toBeNull()
  })
})

describe('correspondance de valeurs (B-IMP-32)', () => {
  it('propose une table à partir du dictionnaire livré ; valeurs inconnues signalées, pas devinées', () => {
    const t = suggestValueMap(['Etat', 'Crime organisé', 'Vengeur', 'Acteur privé (y compris concurrent)', 'Zorglub'], 'sourceCategory')
    expect(t).toEqual({ Etat: 'ETAT_NATION', 'Crime organisé': 'CYBERCRIMINEL', Vengeur: 'EMPLOYE_MALVEILLANT', 'Acteur privé (y compris concurrent)': 'CONCURRENT', Zorglub: null })
  })
  it('statuts de mesure et stratégies de traitement', () => {
    expect(suggestValueMap(['Terminé', 'A réaliser', 'En cours', 'Abandonné / Suspendu'], 'measureStatus')).toEqual({ Terminé: 'REALISE', 'A réaliser': 'A_FAIRE', 'En cours': 'EN_COURS', 'Abandonné / Suspendu': 'REPORTE' })
    expect(suggestValueMap(['Réduction', 'Partage', 'Acceptation', 'Evitement'], 'treatment')).toEqual({ Réduction: 'REDUIRE', Partage: 'TRANSFERER', Acceptation: 'ACCEPTER', Evitement: 'REFUSER' })
  })
  it('applyValueMap : insensible à la casse et aux accents ; AUTRE seulement si demandé, et signalé', () => {
    const table = { Etat: 'ETAT_NATION' }
    expect(applyValueMap('etat', table)).toEqual({ value: 'ETAT_NATION', status: 'MAPPED' })
    expect(applyValueMap('Zorglub', table)).toEqual({ value: null, status: 'UNMAPPED' })
    expect(applyValueMap('Zorglub', table, { fallback: 'AUTRE' })).toEqual({ value: 'AUTRE', status: 'DEFAULTED' })
    expect(applyValueMap('', table, { fallback: 'AUTRE' })).toEqual({ value: null, status: 'EMPTY' })
  })
})

describe('retenu Oui / Non / Peut-être et lignes modèles (B-IMP-44/45)', () => {
  it('normalizeRetained', () => {
    expect(normalizeRetained('Oui')).toBe('YES'); expect(normalizeRetained('non')).toBe('NO'); expect(normalizeRetained('Peut-être')).toBe('MAYBE')
    expect(normalizeRetained('yes')).toBe('YES'); expect(normalizeRetained('x')).toBeNull(); expect(normalizeRetained('')).toBeNull()
  })
  it('filterRetained : seulement les retenus, ou retenus + à confirmer, ou tout', () => {
    const rows = [{ a: '1', r: 'Oui' }, { a: '2', r: 'Non' }, { a: '3', r: 'Peut-être' }, { a: '4', r: '' }]
    expect(filterRetained(rows, 'r', 'ONLY_RETAINED').map(x => x.a)).toEqual(['1'])
    expect(filterRetained(rows, 'r', 'RETAINED_AND_MAYBE').map(x => x.a)).toEqual(['1', '3'])
    expect(filterRetained(rows, 'r', 'ALL').map(x => x.a)).toEqual(['1', '2', '3', '4'])
  })
  it('isTemplateRow : la référence est la seule cellule renseignée', () => {
    expect(isTemplateRow({ 'Réf.VM': 'VM_07', Dénomination: '', Description: '' }, 'Réf.VM')).toBe(true)
    expect(isTemplateRow({ 'Réf.VM': 'VM_01', Dénomination: 'Admin' }, 'Réf.VM')).toBe(false)
    expect(isTemplateRow({ 'Réf.VM': '', Dénomination: '' }, 'Réf.VM')).toBe(false)
  })
})

describe('groupRows — N lignes → 1 parent + enfants (B-IMP-30)', () => {
  const rows = [
    { source: 'Etat', objectif: 'Espionnage', motivation: '++' },
    { source: 'Etat', objectif: 'Influence', motivation: '++' },
    { source: 'Crime organisé', objectif: 'Lucratif', motivation: '+++' },
    { source: 'Etat', objectif: 'Prépositionnement', motivation: '+++' },
  ]
  it('regroupe par source, garde l’ordre, rapporte les conflits de colonnes propres au parent', () => {
    const g = groupRows(rows, 'source', ['motivation'])
    expect(g.map(x => [x.key, x.rows.length])).toEqual([['Etat', 3], ['Crime organisé', 1]])
    expect(g[0].parent).toEqual({ source: 'Etat', motivation: '++' })
    expect(g[0].conflicts).toEqual([{ column: 'motivation', values: ['++', '+++'] }])
    expect(g[1].conflicts).toEqual([])
  })
  it('clé vide : la ligne reste seule (jamais rattachée au groupe précédent)', () => {
    const g = groupRows([{ source: '', objectif: 'x' }, { source: 'A', objectif: 'y' }], 'source', [])
    expect(g).toHaveLength(2)
  })
})

describe('aliasPrefix — préfixe différent entre feuilles (B-IMP-40)', () => {
  it('applique un alias validé (R_ ⇒ RI_) ; sans alias, aucune correspondance', () => {
    expect(aliasPrefix('R_05', { R: 'RI' })).toBe('RI_05')
    expect(aliasPrefix('R5', { R: 'RI' })).toBe('RI5')
    expect(aliasPrefix('R_05', {})).toBe('R_05')
    expect(aliasPrefix('RR_05', { R: 'RI' })).toBe('RR_05')
  })
})
