import { describe, expect, it } from 'vitest'
import { mapProcessusColumns, planProcessusImport, type ProcessusImportRow } from '@/lib/processus-import'

const row = (line: number, nom: string, ref?: string, parent?: string, extra: Partial<ProcessusImportRow> = {}): ProcessusImportRow => ({ line, nom, ref, parent, ...extra })
const status = (plan: ReturnType<typeof planProcessusImport>) => Object.fromEntries(plan.lines.map(l => [l.line, l.reason ? `${l.status}:${l.reason}` : l.status]))

describe('mapProcessusColumns — en-têtes courants (fr/en, accents ignorés)', () => {
  it('reconnaît référence, parent, nom, description, propriétaire', () => {
    expect(mapProcessusColumns(['Réf.', 'Processus parent', 'Nom du processus', 'Description', 'Propriétaire'])).toEqual({ ref: 'Réf.', parent: 'Processus parent', nom: 'Nom du processus', description: 'Description', proprietaire: 'Propriétaire' })
    expect(mapProcessusColumns(['ID', 'Parent ID', 'Name', 'Owner'])).toEqual({ ref: 'ID', parent: 'Parent ID', nom: 'Name', proprietaire: 'Owner' })
  })
  it('une même colonne ne sert qu’un champ ; « processus parent » n’est pas le nom', () => {
    const m = mapProcessusColumns(['Processus', 'Processus parent'])
    expect(m.nom).toBe('Processus'); expect(m.parent).toBe('Processus parent')
  })
})

describe('planProcessusImport — aperçu ligne à ligne', () => {
  it('fichier hiérarchique valide : parents créés avant leurs enfants, liens par référence ou par nom', () => {
    const plan = planProcessusImport([row(2, 'Achats', 'P1'), row(3, 'Commande', 'P1.1', 'P1'), row(4, 'Réception', undefined, 'Achats')], [])
    expect(status(plan)).toEqual({ 2: 'READY', 3: 'READY', 4: 'READY' })
    expect(plan.toCreate.map(l => l.line)).toEqual([2, 3, 4])
    expect(plan.toCreate[1].parentLine).toBe(2); expect(plan.toCreate[2].parentLine).toBe(2)
  })
  it('enfant listé avant son parent : l’ordre de création est corrigé', () => {
    const plan = planProcessusImport([row(2, 'Commande', 'P1.1', 'P1'), row(3, 'Achats', 'P1')], [])
    expect(plan.toCreate.map(l => l.line)).toEqual([3, 2])
  })
  it('explique chaque anomalie à sa ligne et conserve les lignes valides', () => {
    const plan = planProcessusImport([
      row(2, 'Achats', 'P1'),
      row(3, '', 'P2'),                       // nom manquant
      row(4, 'Doublon de réf', 'P1'),          // référence en double
      row(5, 'Orphelin', 'P4', 'P99'),         // parent inconnu
      row(6, 'A', 'PA', 'PB'), row(7, 'B', 'PB', 'PA'), // cycle
      row(8, 'Soi-même', 'PS', 'PS'),          // son propre parent
      row(9, 'Fils d’un rejeté', 'PX', 'PA'),  // parent rejeté
      row(10, 'Valide', 'P10', 'P1'),
    ], [])
    expect(status(plan)).toEqual({
      2: 'READY', 3: 'REJECTED:missing_name', 4: 'REJECTED:duplicate_ref', 5: 'REJECTED:unknown_parent',
      6: 'REJECTED:cycle', 7: 'REJECTED:cycle', 8: 'REJECTED:self_parent', 9: 'REJECTED:parent_rejected', 10: 'READY',
    })
    expect(plan.counts).toMatchObject({ ready: 2, rejected: 7 })
  })
  it('nom de parent ambigu dans le fichier : rejeté avec explication', () => {
    const plan = planProcessusImport([row(2, 'RH'), row(3, 'RH'), row(4, 'Paie', undefined, 'RH')], [])
    expect(status(plan)[4]).toBe('REJECTED:ambiguous_parent')
  })
  it('réimport : les lignes déjà importées (même référence) ne sont pas recréées et les enfants restent liés à l’existant', () => {
    const existing = [{ id: 'db1', nom: 'Achats (renommé)', parentId: null, importKey: 'import:P1' }]
    const plan = planProcessusImport([row(2, 'Achats', 'P1'), row(3, 'Commande', 'P1.1', 'P1')], existing)
    expect(status(plan)).toEqual({ 2: 'ALREADY_IMPORTED', 3: 'READY' })
    expect(plan.toCreate[0].parentExistingId).toBe('db1')
  })
  it('même nom sous le même parent qu’un processus existant : à confirmer, jamais fusionné ; « créer quand même » possible', () => {
    const existing = [{ id: 'db1', nom: 'Achats', parentId: null, importKey: null }]
    const plan = planProcessusImport([row(2, 'achats')], existing)
    expect(status(plan)).toEqual({ 2: 'POSSIBLE_DUPLICATE' }); expect(plan.toCreate).toHaveLength(0)
    const forced = planProcessusImport([row(2, 'achats')], existing, { createAnyway: [2] })
    expect(status(forced)).toEqual({ 2: 'READY' }); expect(forced.toCreate).toHaveLength(1)
  })
  it('parent = processus existant, retrouvé par sa clé d’import ou par son nom unique', () => {
    const existing = [{ id: 'db1', nom: 'Finance', parentId: null, importKey: 'import:F' }, { id: 'db2', nom: 'RH', parentId: null, importKey: null }]
    const plan = planProcessusImport([row(2, 'Trésorerie', 'F1', 'F'), row(3, 'Paie', 'R1', 'RH')], existing)
    expect(plan.toCreate.map(l => l.parentExistingId)).toEqual(['db1', 'db2'])
  })
  it('nom trop long : rejeté ; les champs sont bornés', () => {
    expect(status(planProcessusImport([row(2, 'x'.repeat(201))], []))[2]).toBe('REJECTED:name_too_long')
  })
})
