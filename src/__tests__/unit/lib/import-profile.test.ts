import { describe, expect, it } from 'vitest'
import { BUILTIN_PROFILES, matchProfile, rankProfiles, sanitizeProfile, profileToSelection, type ImportProfile } from '@/lib/import-profile'

const sheets = (defs: [string, string[]][]) => defs.map(([name, columns]) => ({ name, columns }))
const dossier = sheets([
  ['Page de garde', ['Nom projet']], ['Sommaire', ['Généralités']], ['Métriques', ['Besoins de sécurité']],
  ['5 - Risques initiaux', ['Réf.RI', 'Réf.SS', 'Gravité initiale', 'Réf.SO', 'Vraisemblance initiale', 'Niveau de risque initial', 'Description du risque', 'Traitement du risque initial']],
  ['5 - PACS', ['Réf. de la mesure de sécurité', 'Description courte de la mesure', 'Statut', 'Responsable', 'Priorité']],
])

describe('reconnaissance d’un profil (B-IMP-23)', () => {
  it('le profil livré « Dossier de sécurité EBIOS RM » est reconnu sur un classeur de ce type, tolérant aux feuilles en plus', () => {
    const p = BUILTIN_PROFILES.find(x => x.id === 'builtin-dossier-securite-ebios')!
    const m = matchProfile(p, [...dossier, ...sheets([['Feuille supplémentaire', ['x']]])])
    expect(m.score).toBeGreaterThanOrEqual(0.9)
    expect(m.missingSheets).toEqual([])
  })
  it('classeur d’un autre format : score faible, feuilles manquantes listées', () => {
    const p = BUILTIN_PROFILES.find(x => x.id === 'builtin-dossier-securite-ebios')!
    const m = matchProfile(p, sheets([['Registre', ['Risque', 'Impact']]]))
    expect(m.score).toBeLessThan(0.3)
    expect(m.missingSheets.length).toBeGreaterThan(0)
  })
  it('colonne renommée : tolérée mais signalée', () => {
    const p = BUILTIN_PROFILES.find(x => x.id === 'builtin-dossier-securite-ebios')!
    const renamed = dossier.map(s => (s.name === '5 - PACS' ? { ...s, columns: s.columns.filter(c => c !== 'Statut') } : s))
    const m = matchProfile(p, renamed)
    expect(m.missingColumns).toContainEqual({ sheet: '5 - PACS', column: 'Statut' })
    expect(m.score).toBeGreaterThan(0.6)
  })
  it('rankProfiles : meilleur d’abord, uniquement au-dessus du seuil', () => {
    const r = rankProfiles(BUILTIN_PROFILES, dossier, 0.6)
    expect(r[0].profile.id).toBe('builtin-dossier-securite-ebios')
    expect(rankProfiles(BUILTIN_PROFILES, sheets([['Divers', ['a']]]), 0.6)).toEqual([])
  })
})

describe('profil → sélection de l’assistant', () => {
  it('rôles de feuilles, colonnes et correspondances de valeurs prêts à charger', () => {
    const p = BUILTIN_PROFILES.find(x => x.id === 'builtin-dossier-securite-ebios')!
    const sel = profileToSelection(p, dossier)
    expect(sel.sheetTypes['5 - Risques initiaux']).toBe('RISKS')
    expect(sel.sheetTypes['5 - PACS']).toBe('MEASURES')
    expect(sel.sheetTypes['Sommaire']).toBe('UNKNOWN')
    expect(sel.mappings['5 - Risques initiaux']).toMatchObject({ externalId: 'Réf.RI', title: 'Description du risque', gravity: 'Gravité initiale', likelihood: 'Vraisemblance initiale' })
    expect(sel.statusMappings['5 - PACS']).toMatchObject({ Terminé: 'REALISE', 'A réaliser': 'A_FAIRE' })
  })
})

describe('sanitizeProfile — import d’un profil JSON (B-IMP-24)', () => {
  const valid: ImportProfile = { version: 1, id: 'p1', name: 'Mon cabinet', sheets: [{ match: { name: 'Risques' }, role: 'RISKS', fields: { title: 'Libellé' } }], statusMappings: {}, scoreMappings: {} }
  it('profil valide conservé ; identifiant et nom bornés', () => {
    expect(sanitizeProfile({ ...valid, name: 'x'.repeat(500) })).toMatchObject({ ok: true })
    const r = sanitizeProfile({ ...valid, name: 'x'.repeat(500) })
    expect(r.ok && r.profile.name.length).toBeLessThanOrEqual(100)
  })
  it('refuse : version inconnue, rôle inconnu, structure non conforme, trop de feuilles', () => {
    expect(sanitizeProfile({ ...valid, version: 9 })).toEqual({ ok: false, error: 'profile_version_unsupported' })
    expect(sanitizeProfile({ ...valid, sheets: [{ match: { name: 'R' }, role: 'PIRATE', fields: {} }] })).toEqual({ ok: false, error: 'profile_invalid' })
    expect(sanitizeProfile('nimporte quoi')).toEqual({ ok: false, error: 'profile_invalid' })
    expect(sanitizeProfile({ ...valid, sheets: Array.from({ length: 200 }, () => valid.sheets[0]) })).toEqual({ ok: false, error: 'profile_invalid' })
  })
  it('n’exécute rien : champs inconnus écartés, aucune expression conservée', () => {
    const r = sanitizeProfile({ ...valid, evil: 'process.exit()', sheets: [{ ...valid.sheets[0], script: 'x' }] })
    expect(r.ok).toBe(true)
    expect(JSON.stringify(r)).not.toContain('process.exit')
    expect(JSON.stringify(r)).not.toContain('"script"')
  })
})
