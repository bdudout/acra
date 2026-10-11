import { describe, expect, it } from 'vitest'
import { sanitizePapiers, appliquerPapiers, type Papier } from '@/lib/papiers-travail'

const now = new Date('2026-09-29T10:00:00Z')
let n = 0
const ctx = (acteur: string) => ({ acteur, now, newId: () => `p${++n}` })
const data = { type: 'TEST', titre: 'Revue des accès privilégiés', objectif: 'Vérifier les revues', travaux: 'Échantillon de 25 comptes', conclusion: '2 écarts', reference: 'GED-42' }

describe('papiers de travail — cycle', () => {
  it('ajoute un papier en brouillon, préparé par l’auditeur ; titre obligatoire ; type inconnu → AUTRE', () => {
    const r = appliquerPapiers([], { action: 'AJOUTER', data }, ctx('a1'))
    expect(r.ok && r.papiers[0]).toMatchObject({ id: expect.any(String), type: 'TEST', titre: 'Revue des accès privilégiés', statut: 'BROUILLON', preparePar: 'a1', prepareLe: now.toISOString() })
    expect(appliquerPapiers([], { action: 'AJOUTER', data: { ...data, titre: '  ' } }, ctx('a1'))).toEqual({ ok: false, error: 'titre_requis' })
    const inconnu = appliquerPapiers([], { action: 'AJOUTER', data: { ...data, type: 'XXX' } }, ctx('a1'))
    expect(inconnu.ok && inconnu.papiers[0].type).toBe('AUTRE')
  })
  const base = (): Papier[] => { const r = appliquerPapiers([], { action: 'AJOUTER', data }, ctx('a1')); if (!r.ok) throw new Error(); return r.papiers }
  it('le préparateur modifie / supprime tant que c’est un brouillon, pas un autre', () => {
    const [p] = base()
    const m = appliquerPapiers([p], { action: 'MODIFIER', id: p.id, data: { ...data, titre: 'Nouveau titre' } }, ctx('a1'))
    expect(m.ok && m.papiers[0].titre).toBe('Nouveau titre')
    expect(appliquerPapiers([p], { action: 'MODIFIER', id: p.id, data }, ctx('a2'))).toEqual({ ok: false, error: 'modification_interdite' })
    expect(appliquerPapiers([p], { action: 'SUPPRIMER', id: p.id }, ctx('a2'))).toEqual({ ok: false, error: 'modification_interdite' })
    expect(appliquerPapiers([p], { action: 'SUPPRIMER', id: p.id }, ctx('a1'))).toEqual({ ok: true, papiers: [] })
    expect(appliquerPapiers([p], { action: 'MODIFIER', id: 'zzz', data }, ctx('a1'))).toEqual({ ok: false, error: 'papier_introuvable' })
  })
  it('soumission : travaux requis ; un papier soumis n’est plus modifiable', () => {
    const [p] = base()
    const vide = appliquerPapiers([{ ...p, travaux: '' }], { action: 'SOUMETTRE', id: p.id }, ctx('a1'))
    expect(vide).toEqual({ ok: false, error: 'travaux_requis' })
    const s = appliquerPapiers([p], { action: 'SOUMETTRE', id: p.id }, ctx('a1'))
    expect(s.ok && s.papiers[0].statut).toBe('SOUMIS')
    if (!s.ok) return
    expect(appliquerPapiers(s.papiers, { action: 'MODIFIER', id: p.id, data }, ctx('a1'))).toEqual({ ok: false, error: 'modification_interdite' })
  })
  it('revue : jamais par le préparateur ; renvoi avec commentaire obligatoire', () => {
    const [p] = base()
    const s = appliquerPapiers([p], { action: 'SOUMETTRE', id: p.id }, ctx('a1'))
    if (!s.ok) throw new Error()
    expect(appliquerPapiers(s.papiers, { action: 'REVOIR', id: p.id }, ctx('a1'))).toEqual({ ok: false, error: 'revue_meme_personne' })
    const r = appliquerPapiers(s.papiers, { action: 'REVOIR', id: p.id, commentaire: 'RAS' }, ctx('a2'))
    expect(r.ok && r.papiers[0]).toMatchObject({ statut: 'REVU', revuePar: 'a2', revueLe: now.toISOString(), revueCommentaire: 'RAS' })
    expect(appliquerPapiers(s.papiers, { action: 'RENVOYER', id: p.id }, ctx('a2'))).toEqual({ ok: false, error: 'commentaire_requis' })
    const back = appliquerPapiers(s.papiers, { action: 'RENVOYER', id: p.id, commentaire: 'Compléter l’échantillon' }, ctx('a2'))
    expect(back.ok && back.papiers[0]).toMatchObject({ statut: 'BROUILLON', revueCommentaire: 'Compléter l’échantillon' })
    if (!r.ok) return
    expect(appliquerPapiers(r.papiers, { action: 'REVOIR', id: p.id }, ctx('a2'))).toEqual({ ok: false, error: 'transition_interdite' })
  })
})

describe('sanitizePapiers', () => {
  it('lecture défensive : non-tableau, entrées invalides écartées, statut inconnu → BROUILLON', () => {
    expect(sanitizePapiers(null)).toEqual([])
    const r = sanitizePapiers([{ id: 'x', titre: 'T', type: 'TEST', statut: 'bizarre', preparePar: 'a', prepareLe: now.toISOString(), travaux: '' }, 'junk', { titre: '' }])
    expect(r).toHaveLength(1)
    expect(r[0].statut).toBe('BROUILLON')
  })
})

// Trame libre (cadrage 2026-10-11, option a) : un papier peut être rattaché à un constat de la mission et porter des
// pièces de la bibliothèque documentaire (identifiants, ≤ 10, sans doublon) — validés côté serveur dans l'organisation.
describe('papiers — constat et pièces rattachés', () => {
  it('constat et pièces conservés ; liste bornée et dédoublonnée ; valeurs invalides écartées', () => {
    const r = appliquerPapiers([], { action: 'AJOUTER', data: { titre: 'Test des accès', travaux: 'Échantillon de 25 comptes', constatId: 'c1', documentIds: ['d1', 'd1', 'd2', 7, ...Array.from({ length: 12 }, (_, i) => `x${i}`)] } }, ctx('a1'))
    if (!r.ok) throw new Error(r.error)
    expect(r.papiers[0].constatId).toBe('c1')
    expect(r.papiers[0].documentIds).toEqual(['d1', 'd2', 'x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7'])
    const sans = appliquerPapiers([], { action: 'AJOUTER', data: { titre: 'Entretien', travaux: 'x', constatId: '', documentIds: 'd1' } }, ctx('a2'))
    if (!sans.ok) throw new Error(sans.error)
    expect(sans.papiers[0]).not.toHaveProperty('constatId')
    expect(sans.papiers[0]).not.toHaveProperty('documentIds')
  })
  it('relu depuis la base (sanitizePapiers) : rattachements conservés', () => {
    expect(sanitizePapiers([{ id: 'p1', type: 'TEST', titre: 'T', travaux: 'x', statut: 'BROUILLON', preparePar: 'u', prepareLe: '2026-10-11', constatId: 'c1', documentIds: ['d1'] }])[0]).toMatchObject({ constatId: 'c1', documentIds: ['d1'] })
  })
})
