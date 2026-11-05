// Outils MCP de LECTURE de la stratégie (lot S5b) : read_strategies, read_strategie. Preuve d'isolation : un faux prisma
// enregistre CHAQUE requête ; celles qui portent sur un modèle à organizationId doivent être bornées à orgA (1er niveau
// du where), celles du cadre (axes, objectifs, rattachements) à la stratégie déjà vérifiée DANS orgA.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const appels: { cible: string; args: any }[] = []
  const reponses = new Map<string, unknown>()
  const repondre = (cible: string, methode: string, args: unknown) => {
    appels.push({ cible, args })
    const r = reponses.get(cible)
    if (typeof r === 'function') return r(args)
    if (r !== undefined) return r
    return methode === 'findMany' ? [] : null
  }
  const modele = (nom: string) => new Proxy({}, { get: (_t, m: string) => async (args: unknown) => repondre(`${nom}.${m}`, m, args) })
  const prisma = new Proxy({}, { get: (_t, nom: string) => modele(nom) })
  return {
    appels, reponses, prisma,
    cfg: {} as Record<string, unknown>,
    acteur: { value: { userId: 'u1', role: 'RSSI' } as { userId: string; role: string } | null },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: h.prisma }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => h.cfg) }))
vi.mock('@/lib/mcp/acteur.server', () => ({ acteurMcp: vi.fn(async () => h.acteur.value) }))
vi.mock('@/lib/action-items.server', () => ({ gatherActionItems: vi.fn(async () => []) }))

import { buildStrategieTools } from '@/lib/mcp/tools-strategie.server'
import { gatherActionItems } from '@/lib/action-items.server'

const ctx = { organizationId: 'orgA', keyId: 'k1' }
const tools = Object.fromEntries(buildStrategieTools().map(t => [t.name, t]))
const appeler = (nom: string, args: Record<string, unknown> = {}) => tools[nom].handler(args, ctx)
const argsDe = (n: string) => (n === 'read_strategie' ? { strategieId: 's1' } : {})
const json = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text)

function borneeOrgA(args: any): boolean {
  if (JSON.stringify(args ?? null).includes('orgB')) return false
  const w = args?.where
  if (!w || w.organizationId !== 'orgA') return false
  return !(w.OR !== undefined && JSON.stringify(w.OR).includes('organizationId'))
}
const AVEC_ORG = ['strategie.', 'kri.', 'strategieEvolution.']

const STRAT = {
  id: 's1', organizationId: 'orgA', titre: 'Stratégie cyber 2026-2028', description: 'd', type: 'CYBER', periodeDebut: new Date('2026-01-01'), periodeFin: new Date('2028-12-31'),
  statut: 'VALIDEE', version: 2, valideeLe: new Date('2026-02-01'), referenceInterne: 'BUD-1', identifiantsExternes: [{ systeme: 'SAP', valeur: 'CC-9' }],
  cadreValide: { axes: [{ id: 'ax1', ordre: 0, titre: 'Gouverner', description: null, referenceRef: null, referenceInterne: null, identifiantsExternes: null, objectifs: [] }] },
}

beforeEach(() => {
  vi.clearAllMocks()
  h.appels.length = 0
  h.reponses.clear()
  for (const k of Object.keys(h.cfg)) delete h.cfg[k]
  Object.assign(h.cfg, { strategieActive: true })
  h.acteur.value = { userId: 'u1', role: 'RSSI' }
})

describe('déclaration et gardes', () => {
  it('2 outils, sans organizationId, descriptions en français', () => {
    expect(Object.keys(tools).sort()).toEqual(['read_strategie', 'read_strategies'])
    for (const t of Object.values(tools)) {
      expect((t.inputSchema as { properties: Record<string, unknown> }).properties.organizationId).toBeUndefined()
      expect(t.description).toMatch(/stratégie/i)
    }
  })
  it('clé sans membre : refus ; module inactif : refus ; rôle sans lecture : refus — aucune lecture', async () => {
    h.acteur.value = null
    for (const n of Object.keys(tools)) expect((await appeler(n, argsDe(n))).content[0].text).toContain('cle_sans_membre')
    h.acteur.value = { userId: 'u1', role: 'RSSI' }
    h.cfg.strategieActive = false
    for (const n of Object.keys(tools)) expect((await appeler(n, argsDe(n))).content[0].text).toContain('module_inactif')
    h.cfg.strategieActive = true
    h.acteur.value = { userId: 'u1', role: 'METIER' }
    for (const n of Object.keys(tools)) expect((await appeler(n, argsDe(n))).content[0].text).toContain('role_non_autorise')
    expect(h.appels).toHaveLength(0)
  })
  it('argument inconnu refusé', async () => {
    expect((await appeler('read_strategies', { organizationId: 'orgB' })).content[0].text).toContain('argument_inconnu')
  })
})

describe('read_strategies', () => {
  it('liste de l’org, archivées exclues par défaut, identifiants et nombre d’axes', async () => {
    h.reponses.set('strategie.findMany', [{ ...STRAT, _count: { axes: 3 } }])
    const d = json(await appeler('read_strategies'))
    const a = h.appels[0].args
    expect(a.where).toMatchObject({ organizationId: 'orgA', statut: { not: 'ARCHIVEE' } })
    expect(d.tronque).toBe(false)
    expect(d.strategies[0]).toMatchObject({
      id: 's1', type: 'CYBER', periodeDebut: '2026-01-01', periodeFin: '2028-12-31', statut: 'VALIDEE', version: 2, referenceInterne: 'BUD-1',
      identifiantsExternes: [{ systeme: 'SAP', valeur: 'CC-9' }], valideeLe: '2026-02-01', nbAxes: 3,
    })
    expect(JSON.stringify(d)).not.toContain('organizationId')
  })
  it('filtre statut ; inclureArchivees lève l’exclusion', async () => {
    await appeler('read_strategies', { statut: 'BROUILLON' })
    expect(h.appels[0].args.where).toMatchObject({ organizationId: 'orgA', statut: 'BROUILLON' })
    h.appels.length = 0
    await appeler('read_strategies', { inclureArchivees: true })
    expect(h.appels[0].args.where.statut).toBeUndefined()
  })
  it('bornée à 50 : tronque = true si la limite est atteinte', async () => {
    h.reponses.set('strategie.findMany', Array.from({ length: 51 }, (_, i) => ({ ...STRAT, id: `s${i}`, _count: { axes: 0 } })))
    const d = json(await appeler('read_strategies'))
    expect(d.strategies).toHaveLength(50)
    expect(d.tronque).toBe(true)
    expect(h.appels[0].args.take).toBe(51)
  })
})

describe('read_strategie', () => {
  const cadre = () => {
    h.reponses.set('strategie.findFirst', STRAT)
    h.reponses.set('axeStrategique.findMany', [{ id: 'ax1', strategieId: 's1', ordre: 0, titre: 'Gouverner', description: null, referenceRef: 'GV', referenceInterne: 'A1', identifiantsExternes: null }, { id: 'ax2', strategieId: 's1', ordre: 1, titre: 'Protéger', description: null, referenceRef: null, referenceInterne: null, identifiantsExternes: null }])
    h.reponses.set('objectifStrategique.findMany', [{ id: 'o1', axeId: 'ax1', titre: 'MFA partout', indicateur: '% comptes', cible: '100 %', echeance: new Date('2027-06-30'), kriId: 'k1', referenceInterne: null, identifiantsExternes: null }])
    h.reponses.set('rattachementStrategique.findMany', [
      { id: 'r1', axeId: 'ax1', sourceType: 'PLAN_ACTION', sourceId: 'pa1', provenance: 'MCP', createdAt: new Date('2026-03-01') },
      { id: 'r2', axeId: 'ax1', sourceType: 'INCIDENT', sourceId: 'inc9', provenance: 'MANUEL', createdAt: new Date('2026-03-02') },
    ])
    h.reponses.set('kri.findMany', [{ id: 'k1', intitule: 'Taux MFA' }])
    h.reponses.set('strategieEvolution.findMany', [{ id: 'e1', type: 'AJOUT_AXE', justification: 'Nouvel axe', createdAt: new Date('2026-04-01'), cibleId: 'ax2', auteurId: 'u9', avant: { x: 1 } }])
    vi.mocked(gatherActionItems).mockResolvedValue([{ source: 'PLAN_ACTION', sourceId: 'pa1', titre: 'Déployer le MFA' }] as never)
  }
  it('cadre complet, KRI, titres de sources visibles, écart, évolutions sans auteur ni e-mail', async () => {
    cadre()
    const d = json(await appeler('read_strategie', { strategieId: 's1' }))
    expect(d.strategie).toMatchObject({ id: 's1', referenceInterne: 'BUD-1', version: 2 })
    expect(d.axes.map((a: { id: string }) => a.id)).toEqual(['ax1', 'ax2'])
    expect(d.axes[0]).toMatchObject({ referenceInterne: 'A1', referenceRef: 'GV' })
    expect(d.axes[0].objectifs[0]).toMatchObject({ id: 'o1', indicateur: '% comptes', cible: '100 %', echeance: '2027-06-30', kri: { id: 'k1', nom: 'Taux MFA' } })
    expect(d.axes[0].rattachements).toEqual([
      expect.objectContaining({ sourceType: 'PLAN_ACTION', sourceId: 'pa1', titre: 'Déployer le MFA', provenance: 'MCP' }),
      expect.objectContaining({ sourceType: 'INCIDENT', sourceId: 'inc9', titre: null, provenance: 'MANUEL' }),
    ])
    expect(d.ecartCadreValide.identique).toBe(false)
    expect(d.ecartCadreValide.axes.ajoutes.map((a: { id: string }) => a.id)).toEqual(['ax2'])
    expect(d.evolutions).toEqual([{ type: 'AJOUT_AXE', date: '2026-04-01', justification: 'Nouvel axe', cibleId: 'ax2' }])
    expect(JSON.stringify(d)).not.toMatch(/u9|@/)
    const [orgId, , access] = vi.mocked(gatherActionItems).mock.calls[0]
    expect(orgId).toBe('orgA')
    expect(access).toEqual({ userId: 'u1', role: 'RSSI', scope: { visibleOrgIds: ['orgA'] } })
  })
  it('évolutions : 20 dernières, plus récentes d’abord ; requêtes bornées à orgA', async () => {
    cadre()
    await appeler('read_strategie', { strategieId: 's1' })
    const ev = h.appels.find(a => a.cible === 'strategieEvolution.findMany')!
    expect(ev.args).toMatchObject({ take: 20, orderBy: { createdAt: 'desc' } })
    expect(ev.args.where).toMatchObject({ strategieId: 's1' })
    for (const a of h.appels.filter(a => AVEC_ORG.some(p => a.cible.startsWith(p)))) expect(borneeOrgA(a.args), `${a.cible} ${JSON.stringify(a.args)}`).toBe(true)
    for (const a of h.appels.filter(a => /^(axe|objectif|rattachement)/.test(a.cible))) expect(JSON.stringify(a.args.where)).toContain('s1')
  })
  it('stratégie d’une autre org : introuvable, aucune lecture du cadre', async () => {
    h.reponses.set('strategie.findFirst', (a: any) => (a.where.organizationId === 'orgA' && a.where.id === 'sB' ? null : STRAT))
    const r = await appeler('read_strategie', { strategieId: 'sB' })
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toContain('strategie_introuvable')
    expect(h.appels.some(a => /^(axe|objectif|rattachement)/.test(a.cible))).toBe(false)
    expect(borneeOrgA(h.appels[0].args)).toBe(true)
  })
  it('strategieId requis', async () => {
    expect((await appeler('read_strategie', {})).isError).toBe(true)
  })
})
