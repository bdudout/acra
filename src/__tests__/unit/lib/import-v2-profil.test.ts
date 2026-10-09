// B-IMP-72 — API v2 « fichier + profil » : le profil est référencé (profil livré ou mapping enregistré de l'organisation)
// ou fourni dans la requête ; la référence l'emporte ; sans profil, la détection automatique de l'aperçu s'applique.
// États des lignes de B-IMP-53 : prêt / importable sans ce champ / à confirmer / non importable.
import { describe, expect, it } from 'vitest'
import { etatsLignes, normaliserMappingEnregistre, selectionDepuisProfil } from '@/lib/import-v2-profil'
import { BUILTIN_PROFILES } from '@/lib/import-profile'

const apercu = [
  { name: '5 - Risques initiaux', columns: ['Réf.RI', 'Description du risque', 'Gravité initiale'], detection: { type: 'RISKS' as const }, mapping: { externalId: 'Réf.RI', title: 'Description du risque' } },
  { name: 'Notes', columns: ['Texte'], detection: { type: 'UNKNOWN' as const }, mapping: {} },
]
const enregistres = [{ name: 'Mon format', mappings: { version: 2, mappings: { 'Notes': { title: 'Texte' } }, sheetTypes: { Notes: 'RISKS' }, statusMappings: {}, scoreMappings: {}, transforms: {} } }]

describe('selectionDepuisProfil', () => {
  it('sans profil : détection automatique de l’aperçu', () => {
    const r = selectionDepuisProfil({}, apercu, enregistres)
    expect(r).toMatchObject({ ok: true, source: 'AUTO' })
    if (!r.ok) throw new Error()
    expect(r.selection.sheetTypes).toEqual({ '5 - Risques initiaux': 'RISKS', Notes: 'UNKNOWN' })
    expect(r.selection.mappings['5 - Risques initiaux']).toEqual({ externalId: 'Réf.RI', title: 'Description du risque' })
    expect(r.selection.partialImport).toBe(true)
  })
  it('référence à un profil livré (par son identifiant) : colonnes du profil appliquées', () => {
    const r = selectionDepuisProfil({ profilRef: BUILTIN_PROFILES[0].id }, apercu, enregistres)
    expect(r).toMatchObject({ ok: true, source: 'REFERENCE' })
    if (!r.ok) throw new Error()
    expect(r.selection.mappings['5 - Risques initiaux']).toMatchObject({ externalId: 'Réf.RI', title: 'Description du risque', gravity: 'Gravité initiale' })
  })
  it('référence à un mapping enregistré de l’organisation (par son nom)', () => {
    const r = selectionDepuisProfil({ profilRef: 'Mon format' }, apercu, enregistres)
    expect(r).toMatchObject({ ok: true, source: 'REFERENCE' })
    if (!r.ok) throw new Error()
    expect(r.selection.sheetTypes).toEqual({ Notes: 'RISKS' })
  })
  it('profil inline (format d’export d’un profil) ; la référence est prioritaire si les deux sont fournis', () => {
    const inline = { version: 1, id: 'x', name: 'Inline', sheets: [{ match: { name: 'Notes' }, role: 'RISKS', fields: { title: 'Texte' } }], statusMappings: {}, scoreMappings: {} }
    expect(selectionDepuisProfil({ profilInline: inline }, apercu, enregistres)).toMatchObject({ ok: true, source: 'INLINE', selection: { sheetTypes: { Notes: 'RISKS' } } })
    expect(selectionDepuisProfil({ profilRef: 'Mon format', profilInline: inline }, apercu, enregistres)).toMatchObject({ ok: true, source: 'REFERENCE' })
  })
  it('erreurs explicites : référence inconnue, profil inline invalide', () => {
    expect(selectionDepuisProfil({ profilRef: 'Inconnu' }, apercu, enregistres)).toEqual({ ok: false, error: 'profil_introuvable' })
    expect(selectionDepuisProfil({ profilInline: { version: 1 } }, apercu, enregistres)).toEqual({ ok: false, error: 'profile_invalid' })
    expect(selectionDepuisProfil({ profilInline: { version: 9, id: 'x', name: 'y', sheets: [] } }, apercu, enregistres)).toEqual({ ok: false, error: 'profile_version_unsupported' })
  })
})

describe('normaliserMappingEnregistre', () => {
  it('format v2 complet ; ancien format (mappings seuls) accepté', () => {
    expect(normaliserMappingEnregistre(enregistres[0].mappings).sheetTypes).toEqual({ Notes: 'RISKS' })
    expect(normaliserMappingEnregistre({ Feuille: { title: 'Col' } })).toEqual({ mappings: { Feuille: { title: 'Col' } }, sheetTypes: {}, transforms: {}, statusMappings: {}, scoreMappings: {} })
  })
})

describe('etatsLignes (B-IMP-53)', () => {
  it('compte prêt / sans ce champ / à confirmer / non importable ; lignes modèles vides à part', () => {
    expect(etatsLignes([
      { sheetName: 'R', row: 2, status: 'READY' }, { sheetName: 'R', row: 3, status: 'READY' },
      { sheetName: 'R', row: 4, status: 'FIELD_OMITTED', field: 'dueDate', reason: 'INVALID_FORMAT' },
      { sheetName: 'R', row: 5, status: 'REJECTED', field: 'title', reason: 'MISSING_REQUIRED_VALUE' },
      { sheetName: 'R', row: 6, status: 'REJECTED', reason: 'DUPLICATE_REFERENCE' },
      { sheetName: 'R', row: 7, status: 'IGNORED', reason: 'EMPTY_TEMPLATE_ROW' },
    ])).toEqual({ pret: 2, sansCeChamp: 1, aConfirmer: 1, nonImportable: 1, ignorees: 1 })
  })
})
