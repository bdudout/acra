// Lot S2 : catégorie automatique des plans d'action (famille de risque TIC du risque lié, sinon origine) et axes
// stratégiques rattachés (facettes « Catégorie » et « Axe stratégique » de /actions).
import { describe, it, expect } from 'vitest'
import {
  categorieAction, enrichirActions, indexerAxes, filterActionItems, ACTION_CATEGORIES, AXE_NON_RATTACHE,
  type ActionItem, type ActionOrigine,
} from '@/lib/action-items'
import { lireFiltresActions, listerActionsPage, TRIS_ACTIONS } from '@/lib/action-items-liste'
import { lirePagination } from '@/lib/pagination'
import { FAMILLES_RISQUE_TIC } from '@/lib/famille-risque-tic'

const now = new Date('2026-06-01T00:00:00Z')
const mk = (p: Partial<ActionItem>): ActionItem => ({
  id: p.id ?? 'x', source: 'MESURE', origine: 'risque', sourceId: p.sourceId ?? p.id ?? 'x', titre: 't', description: null, porteur: null,
  entite: null, entiteId: null, echeance: null, statut: 'A_FAIRE', priorite: 'MAJEUR', lien: null, riskItemId: null, ...p,
})

describe('categorieAction', () => {
  it('la famille de risque TIC du risque lié prime sur l’origine', () => {
    expect(categorieAction({ origine: 'audit', familleRisqueTic: 'CYBER' })).toBe('CYBER')
    expect(categorieAction({ origine: 'risque', familleRisqueTic: 'TIERS_TIC' })).toBe('TIERS_TIC')
  })
  it('une famille inconnue est ignorée', () => {
    expect(categorieAction({ origine: 'incident', familleRisqueTic: 'FOO' })).toBe('INCIDENT')
  })
  it('sinon, l’origine détermine la catégorie', () => {
    const attendu: Record<ActionOrigine, string> = {
      risque: 'RISQUE', conformite: 'CONFORMITE', audit: 'AUDIT', regulateur: 'AUDIT', controle: 'CONTROLE',
      preconisation: 'CONTROLE', incident: 'INCIDENT', resilience: 'CONTINUITE_IT', orpheline: 'NON_CATEGORISEE',
    }
    for (const [origine, cat] of Object.entries(attendu)) expect(categorieAction({ origine: origine as ActionOrigine })).toBe(cat)
  })
  it('les familles TIC font partie des catégories', () => {
    for (const f of FAMILLES_RISQUE_TIC) expect(ACTION_CATEGORIES).toContain(f)
  })
})

describe('indexerAxes / enrichirActions', () => {
  const rows = [
    { sourceType: 'RISK_ACTION', sourceId: 'r1', axe: { id: 'ax1', titre: 'Protéger', strategie: { id: 's1', titre: 'Cyber 2027' } } },
    { sourceType: 'RISK_ACTION', sourceId: 'r1', axe: { id: 'ax2', titre: 'Détecter', strategie: { id: 's1', titre: 'Cyber 2027' } } },
    { sourceType: 'AUDIT', sourceId: 'k1', axe: { id: 'ax2', titre: 'Détecter', strategie: { id: 's1', titre: 'Cyber 2027' } } },
  ]
  it('indexe les rattachements par clé de l’item (`source:sourceId`)', () => {
    const idx = indexerAxes(rows)
    expect(idx.get('RISK_ACTION:r1')).toEqual([
      { strategieId: 's1', strategieTitre: 'Cyber 2027', axeId: 'ax1', axeTitre: 'Protéger' },
      { strategieId: 's1', strategieTitre: 'Cyber 2027', axeId: 'ax2', axeTitre: 'Détecter' },
    ])
    expect(idx.get('AUDIT:k1')).toHaveLength(1)
  })
  it('ajoute famille, catégorie et axes à chaque item ; sans rattachement : axes vides', () => {
    const items = [
      mk({ id: 'RISK_ACTION:r1', source: 'RISK_ACTION', sourceId: 'r1', riskItemId: 'ri1' }),
      mk({ id: 'AUDIT:k1', source: 'AUDIT', sourceId: 'k1', origine: 'audit', riskItemId: 'ri2' }),
      mk({ id: 'CONFORMITE:c1', source: 'CONFORMITE', sourceId: 'c1', origine: 'conformite' }),
    ]
    const out = enrichirActions(items, new Map([['ri1', 'CYBER']]), indexerAxes(rows))
    expect(out.map(i => i.categorie)).toEqual(['CYBER', 'AUDIT', 'CONFORMITE'])
    expect(out[0].familleRisqueTic).toBe('CYBER')
    expect(out[1].familleRisqueTic).toBeNull()
    expect(out[0].axes).toHaveLength(2)
    expect(out[2].axes).toEqual([])
  })
  it('un riskItemId d’une source qui ne pointe pas vers le registre (risque d’analyse) n’est pas résolu', () => {
    const out = enrichirActions([mk({ source: 'PLAN_ACTION', riskItemId: 'ri1' })], new Map([['ri1', 'CYBER']]), new Map())
    expect(out[0].categorie).toBe('RISQUE')
  })
})

describe('facettes « Catégorie » et « Axe stratégique »', () => {
  const items = enrichirActions([
    mk({ id: 'RISK_ACTION:r1', source: 'RISK_ACTION', sourceId: 'r1', riskItemId: 'ri1' }),
    mk({ id: 'AUDIT:k1', source: 'AUDIT', sourceId: 'k1', origine: 'audit' }),
    mk({ id: 'INCIDENT:i1', source: 'INCIDENT', sourceId: 'i1', origine: 'incident' }),
  ], new Map([['ri1', 'CYBER']]), indexerAxes([
    { sourceType: 'RISK_ACTION', sourceId: 'r1', axe: { id: 'ax1', titre: 'Protéger', strategie: { id: 's1', titre: 'Cyber 2027' } } },
    { sourceType: 'AUDIT', sourceId: 'k1', axe: { id: 'ax2', titre: 'Détecter', strategie: { id: 's1', titre: 'Cyber 2027' } } },
  ]))

  it('filtre par catégorie et par axe (dont « Non rattachée »)', () => {
    expect(filterActionItems(items, { categorie: 'CYBER' }, now).map(i => i.id)).toEqual(['RISK_ACTION:r1'])
    expect(filterActionItems(items, { axe: 'ax2' }, now).map(i => i.id)).toEqual(['AUDIT:k1'])
    expect(filterActionItems(items, { axe: AXE_NON_RATTACHE }, now).map(i => i.id)).toEqual(['INCIDENT:i1'])
  })
  it('catégorie calculée à la volée si l’item n’est pas enrichi', () => {
    expect(filterActionItems([mk({ origine: 'controle' })], { categorie: 'CONTROLE' }, now)).toHaveLength(1)
  })
  it('lecture de l’URL : catégorie validée, axe borné', () => {
    expect(lireFiltresActions(new URLSearchParams('categorie=CYBER&axe=ax1')).filtre).toMatchObject({ categorie: 'CYBER', axe: 'ax1' })
    expect(lireFiltresActions(new URLSearchParams('categorie=FOO')).filtre.categorie).toBeUndefined()
    expect(lireFiltresActions(new URLSearchParams(`axe=${'x'.repeat(300)}`)).filtre.axe).toBeUndefined()
  })
  it('la page expose les axes distincts présents dans les actions (options de la facette)', () => {
    const sp = new URLSearchParams('page=1&categorie=INCIDENT')
    const r = listerActionsPage(items, lireFiltresActions(sp), lirePagination(sp, { tris: TRIS_ACTIONS, triDefaut: 'defaut' })!, [], now)
    expect(r.items.map(i => i.id)).toEqual(['INCIDENT:i1'])
    expect(r.axes.map(a => a.axeId)).toEqual(['ax2', 'ax1']) // tri par stratégie puis titre d'axe
  })
  it('axe inconnu ignoré ; « aucun » ignoré quand aucune action ne porte d’axe', () => {
    const run = (its: ActionItem[], q: string) => {
      const sp = new URLSearchParams(`page=1&${q}`)
      return listerActionsPage(its, lireFiltresActions(sp), lirePagination(sp, { tris: TRIS_ACTIONS, triDefaut: 'defaut' })!, [], now).items.length
    }
    expect(run(items, 'axe=inconnu')).toBe(3)
    expect(run(items, 'axe=aucun')).toBe(1)
    const sansAxes = items.map(i => ({ ...i, axes: [] }))
    expect(run(sansAxes, 'axe=aucun')).toBe(3)
  })
})
