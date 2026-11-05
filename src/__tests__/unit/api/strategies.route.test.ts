// Stratégie cyber / IT / résilience (lot S1a) : routes org-scopées /api/strategies/**.
// Couvre : RBAC (AUDITEUR 403 en écriture), module requis, cadre figé (409) ou non figé (justification + historique),
// rattachement sur VALIDEE, isolation cross-org (404 sans écriture), validation (instantané), nouvelle version, historique.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Row = Record<string, unknown>
const db = vi.hoisted(() => ({
  strategies: [] as Row[], axes: [] as Row[], objectifs: [] as Row[], rattachements: [] as Row[], evolutions: [] as Row[], kris: [] as Row[],
}))
// Écriture concurrente simulée entre la lecture hors transaction et la transaction (course décision ↔ écriture).
const course = vi.hoisted(() => ({ avant: null as null | (() => void) }))
const session = vi.hoisted(() => ({ role: 'RSSI' }))
const cfg = vi.hoisted(() => ({ strategieActive: true, strategieCadreFige: true }))
const gather = vi.hoisted(() => vi.fn())
const audit = vi.hoisted(() => vi.fn())

const match = (r: Row, where: Row = {}): boolean => Object.entries(where).every(([k, v]) => {
  if (k === 'axe' && v && typeof v === 'object') {
    const axe = db.axes.find(a => a.id === r.axeId)
    return !!axe && match(axe, v as Row)
  }
  return r[k] === v
})
let seq = 0
const nid = (p: string) => `${p}${++seq}`

vi.mock('@/lib/prisma', () => {
  const model = (list: () => Row[], p: string) => ({
    findFirst: vi.fn(async ({ where }: { where: Row }) => list().find(r => match(r, where)) ?? null),
    findMany: vi.fn(async ({ where }: { where?: Row } = {}) => list().filter(r => match(r, where ?? {}))),
    count: vi.fn(async ({ where }: { where?: Row } = {}) => list().filter(r => match(r, where ?? {})).length),
    create: vi.fn(async ({ data }: { data: Row }) => { const r = { id: nid(p), createdAt: new Date(), ...data }; list().push(r); return r }),
    update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => { const r = list().find(x => x.id === where.id)!; Object.assign(r, data); return r }),
    updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => { const rs = list().filter(x => match(x, where)); rs.forEach(r => Object.assign(r, data)); return { count: rs.length } }),
    delete: vi.fn(async ({ where }: { where: Row }) => { const l = list(); const i = l.findIndex(x => x.id === where.id); return l.splice(i, 1)[0] }),
  })
  const prisma: Record<string, unknown> = {
    strategie: model(() => db.strategies, 's'),
    axeStrategique: model(() => db.axes, 'a'),
    objectifStrategique: model(() => db.objectifs, 'o'),
    rattachementStrategique: model(() => db.rattachements, 'r'),
    strategieEvolution: model(() => db.evolutions, 'e'),
    kri: model(() => db.kris, 'k'),
  }
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => { course.avant?.(); course.avant = null; return fn(prisma) })
  // Verrou de ligne : SELECT id, statut FROM "Strategie" WHERE id = $1 AND "organizationId" = $2 FOR UPDATE.
  prisma.$queryRaw = vi.fn(async (_sql: TemplateStringsArray, id: string, orgId: string) =>
    db.strategies.filter(r => r.id === id && r.organizationId === orgId).map(r => ({ id: r.id, statut: r.statut })))
  return { prisma }
})
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: session.role } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({
  getAnalyseScope: vi.fn(async () => ({ activeOrgId: 'o1', role: session.role, scope: { visibleOrgIds: ['o1'], isSuperAdmin: false } })),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ ...cfg, incidentsActive: true, controlePermanentActive: true, auditInterneActive: true, registreRisquesActive: true, conformiteActive: true })) }))
vi.mock('@/lib/action-items.server', () => ({ gatherActionItems: gather }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => ({ allowed: true, remaining: 10, resetAt: 0 })), rateLimitHeaders: vi.fn(() => ({})), LIMIT_API_WRITE: { limit: 60, windowMs: 60000 } }))
vi.mock('@/lib/logger', () => ({ auditLog: audit, getClientIp: () => '127.0.0.1' }))

import { GET as LIST, POST as CREATE } from '@/app/api/strategies/route'
import { PATCH as PATCH_STRAT, DELETE as DELETE_STRAT } from '@/app/api/strategies/[id]/route'
import { POST as VALIDER } from '@/app/api/strategies/[id]/valider/route'
import { POST as NOUVELLE_VERSION } from '@/app/api/strategies/[id]/nouvelle-version/route'
import { POST as ADD_AXE } from '@/app/api/strategies/[id]/axes/route'
import { PATCH as PATCH_AXE, DELETE as DELETE_AXE } from '@/app/api/strategies/[id]/axes/[axeId]/route'
import { POST as ADD_OBJ } from '@/app/api/strategies/[id]/axes/[axeId]/objectifs/route'
import { PATCH as PATCH_OBJ } from '@/app/api/strategies/[id]/objectifs/[objectifId]/route'
import { POST as ARCHIVER } from '@/app/api/strategies/[id]/archiver/route'
import { prisma as prismaMock } from '@/lib/prisma'
import { sousVerrouStrategie } from '@/lib/strategie.server'
import { POST as RATTACHER } from '@/app/api/strategies/[id]/rattachements/route'
import { DELETE as DETACHER } from '@/app/api/strategies/[id]/rattachements/[rattachementId]/route'
import { GET as HISTORIQUE } from '@/app/api/strategies/[id]/historique/route'

const req = (method: string, body?: unknown) => new NextRequest('http://localhost/api/strategies', { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const ctx = (p: Record<string, string>) => ({ params: Promise.resolve(p) })
const ecritures = () => db.strategies.length + db.axes.length + db.objectifs.length + db.rattachements.length + db.evolutions.length

function seed(statut = 'BROUILLON') {
  db.strategies.push({ id: 's1', organizationId: 'o1', titre: 'Stratégie 2027', description: null, type: 'CYBER', periodeDebut: null, periodeFin: null, statut, version: 1, valideeLe: statut === 'VALIDEE' ? new Date('2027-01-01') : null, cadreValide: null })
  db.axes.push({ id: 'a1', strategieId: 's1', ordre: 0, titre: 'Protéger', description: null, referenceRef: null })
  db.objectifs.push({ id: 'ob1', axeId: 'a1', titre: 'MFA', indicateur: null, cible: '100 %', echeance: null, kriId: null })
  // Stratégie d'une autre organisation.
  db.strategies.push({ id: 'sX', organizationId: 'o2', titre: 'Autre', statut: 'BROUILLON', version: 1 })
  db.axes.push({ id: 'aX', strategieId: 'sX', ordre: 0, titre: 'Autre axe' })
}

beforeEach(() => {
  vi.clearAllMocks()
  db.strategies.length = 0; db.axes.length = 0; db.objectifs.length = 0; db.rattachements.length = 0; db.evolutions.length = 0; db.kris.length = 0
  course.avant = null
  session.role = 'RSSI'; cfg.strategieActive = true; cfg.strategieCadreFige = true
  gather.mockResolvedValue([{ source: 'AUDIT', sourceId: 'c1' }])
})

describe('création et lecture', () => {
  it('RSSI crée une stratégie BROUILLON v1 dans l’organisation active, journalisée', async () => {
    const res = await CREATE(req('POST', { titre: 'Stratégie cyber 2027-2029', type: 'CYBER' }))
    expect(res.status).toBe(201)
    expect(db.strategies[0]).toMatchObject({ organizationId: 'o1', statut: 'BROUILLON', createdById: 'u1' })
    expect(audit).toHaveBeenCalledWith('STRATEGIE_UPDATED', expect.objectContaining({ organizationId: 'o1' }))
  })
  it('AUDITEUR : lecture OK, écriture 403 sans écriture', async () => {
    seed()
    session.role = 'AUDITEUR'
    expect((await LIST()).status).toBe(200)
    const avant = ecritures()
    expect((await CREATE(req('POST', { titre: 'x', type: 'IT' }))).status).toBe(403)
    expect((await ADD_AXE(req('POST', { titre: 'Détecter' }), ctx({ id: 's1' }))).status).toBe(403)
    expect((await RATTACHER(req('POST', { axeId: 'a1', sourceType: 'AUDIT', sourceId: 'c1' }), ctx({ id: 's1' }))).status).toBe(403)
    expect(ecritures()).toBe(avant)
  })
  it('LECTEUR : lecture 403', async () => {
    session.role = 'LECTEUR'
    expect((await LIST()).status).toBe(403)
  })
  it('module inactif : 404 module_inactif', async () => {
    cfg.strategieActive = false
    const res = await CREATE(req('POST', { titre: 'x', type: 'IT' }))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('module_inactif')
  })
  it('liste : uniquement les stratégies de l’organisation active', async () => {
    seed()
    const j = await (await LIST()).json()
    expect(j.strategies.map((s: Row) => s.id)).toEqual(['s1'])
  })
})

describe('cadre figé après validation', () => {
  it('validation : instantané du cadre, valideePar / valideeLe ; seconde validation 409', async () => {
    seed()
    session.role = 'DIRECTION_METIER'
    const res = await VALIDER(req('POST'), ctx({ id: 's1' }))
    expect(res.status).toBe(200)
    const s = db.strategies[0]
    expect(s).toMatchObject({ statut: 'VALIDEE', valideePar: 'u1' })
    expect(s.valideeLe).toBeInstanceOf(Date)
    expect((s.cadreValide as { axes: Row[] }).axes[0]).toMatchObject({ id: 'a1', titre: 'Protéger', objectifs: [{ id: 'ob1', cible: '100 %' }] })
    expect((await VALIDER(req('POST'), ctx({ id: 's1' }))).status).toBe(409)
  })
  it('RISK_MANAGER ne valide pas (403)', async () => {
    seed()
    session.role = 'RISK_MANAGER'
    expect((await VALIDER(req('POST'), ctx({ id: 's1' }))).status).toBe(403)
  })
  it('option figée (défaut) : modifier un axe d’une stratégie VALIDEE → 409, rien d’écrit', async () => {
    seed('VALIDEE')
    const res = await PATCH_AXE(req('PATCH', { titre: 'Protéger mieux', justification: 'NIS2' }), ctx({ id: 's1', axeId: 'a1' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('cadre_fige')
    expect(db.axes[0].titre).toBe('Protéger')
    expect((await ADD_AXE(req('POST', { titre: 'Détecter', justification: 'x' }), ctx({ id: 's1' }))).status).toBe(409)
    expect((await DELETE_AXE(req('DELETE', { justification: 'x' }), ctx({ id: 's1', axeId: 'a1' }))).status).toBe(409)
    expect(db.evolutions).toHaveLength(0)
  })
  it('option non figée : justification obligatoire (400), puis modification historisée (avant / après)', async () => {
    seed('VALIDEE')
    cfg.strategieCadreFige = false
    const r400 = await PATCH_AXE(req('PATCH', { titre: 'Protéger mieux' }), ctx({ id: 's1', axeId: 'a1' }))
    expect(r400.status).toBe(400)
    expect((await r400.json()).error).toBe('justification_requise')
    const ok = await PATCH_AXE(req('PATCH', { titre: 'Protéger mieux', justification: 'Exigence NIS2' }), ctx({ id: 's1', axeId: 'a1' }))
    expect(ok.status).toBe(200)
    expect(db.axes[0].titre).toBe('Protéger mieux')
    expect(db.evolutions[0]).toMatchObject({ type: 'MODIF_AXE', cibleId: 'a1', justification: 'Exigence NIS2', auteurId: 'u1', organizationId: 'o1', avant: { titre: 'Protéger' }, apres: { titre: 'Protéger mieux' } })
    expect((await ADD_OBJ(req('POST', { titre: 'EDR 100 %', justification: 'Audit 2027' }), ctx({ id: 's1', axeId: 'a1' }))).status).toBe(201)
    expect(db.evolutions[1]).toMatchObject({ type: 'AJOUT_OBJECTIF' })
  })
  it('BROUILLON : modification libre, sans historique', async () => {
    seed()
    expect((await PATCH_AXE(req('PATCH', { titre: 'Identifier' }), ctx({ id: 's1', axeId: 'a1' }))).status).toBe(200)
    expect(db.evolutions).toHaveLength(0)
  })
  it('champs de la stratégie validée : 409 strategie_validee', async () => {
    seed('VALIDEE')
    expect((await PATCH_STRAT(req('PATCH', { titre: 'Nouveau' }), ctx({ id: 's1' }))).status).toBe(409)
    expect((await DELETE_STRAT(req('DELETE'), ctx({ id: 's1' }))).status).toBe(409)
  })
})

describe('rattachements', () => {
  it('sur une stratégie VALIDEE : autorisé avec justification, historisé', async () => {
    seed('VALIDEE')
    session.role = 'CONFORMITE'
    const res = await RATTACHER(req('POST', { axeId: 'a1', sourceType: 'AUDIT', sourceId: 'c1', justification: 'Constat audit mars 2027' }), ctx({ id: 's1' }))
    expect(res.status).toBe(201)
    expect(db.rattachements[0]).toMatchObject({ organizationId: 'o1', axeId: 'a1', sourceType: 'AUDIT', sourceId: 'c1', provenance: 'MANUEL', ajoutePar: 'u1' })
    expect(db.evolutions[0]).toMatchObject({ type: 'AJOUT_RATTACHEMENT', justification: 'Constat audit mars 2027' })
    expect(gather).toHaveBeenCalledWith('o1', expect.anything(), { userId: 'u1', role: 'CONFORMITE', scope: { visibleOrgIds: ['o1'], isSuperAdmin: false } })
  })
  it('sur VALIDEE sans justification : 400 ; retrait justifié historisé', async () => {
    seed('VALIDEE')
    expect((await RATTACHER(req('POST', { axeId: 'a1', sourceType: 'AUDIT', sourceId: 'c1' }), ctx({ id: 's1' }))).status).toBe(400)
    await RATTACHER(req('POST', { axeId: 'a1', sourceType: 'AUDIT', sourceId: 'c1', justification: 'x' }), ctx({ id: 's1' }))
    const rid = db.rattachements[0].id as string
    expect((await DETACHER(req('DELETE', {}), ctx({ id: 's1', rattachementId: rid }))).status).toBe(400)
    expect((await DETACHER(req('DELETE', { justification: 'Hors périmètre' }), ctx({ id: 's1', rattachementId: rid }))).status).toBe(200)
    expect(db.rattachements).toHaveLength(0)
    expect(db.evolutions.map(e => e.type)).toEqual(['AJOUT_RATTACHEMENT', 'RETRAIT_RATTACHEMENT'])
  })
  it('stratégie ARCHIVEE : 409', async () => {
    seed('ARCHIVEE')
    expect((await RATTACHER(req('POST', { axeId: 'a1', sourceType: 'AUDIT', sourceId: 'c1', justification: 'x' }), ctx({ id: 's1' }))).status).toBe(409)
  })
  it('source absente de l’organisation : 404 source_introuvable, rien d’écrit', async () => {
    seed()
    gather.mockResolvedValue([])
    const res = await RATTACHER(req('POST', { axeId: 'a1', sourceType: 'INCIDENT', sourceId: 'inc-o2' }), ctx({ id: 's1' }))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('source_introuvable')
    expect(db.rattachements).toHaveLength(0)
  })
})

describe('isolation entre organisations', () => {
  it('ids d’une autre organisation : 404 sans écriture', async () => {
    seed()
    const avant = JSON.stringify(db)
    expect((await PATCH_STRAT(req('PATCH', { titre: 'pirate' }), ctx({ id: 'sX' }))).status).toBe(404)
    expect((await DELETE_STRAT(req('DELETE'), ctx({ id: 'sX' }))).status).toBe(404)
    expect((await ADD_AXE(req('POST', { titre: 'pirate' }), ctx({ id: 'sX' }))).status).toBe(404)
    expect((await VALIDER(req('POST'), ctx({ id: 'sX' }))).status).toBe(404)
    expect((await NOUVELLE_VERSION(req('POST'), ctx({ id: 'sX' }))).status).toBe(404)
    expect((await HISTORIQUE(req('GET'), ctx({ id: 'sX' }))).status).toBe(404)
    // Axe d'une autre org passé sous une stratégie de l'org active.
    expect((await PATCH_AXE(req('PATCH', { titre: 'pirate' }), ctx({ id: 's1', axeId: 'aX' }))).status).toBe(404)
    expect((await RATTACHER(req('POST', { axeId: 'aX', sourceType: 'AUDIT', sourceId: 'c1' }), ctx({ id: 's1' }))).status).toBe(404)
    expect(JSON.stringify(db)).toBe(avant)
  })
})

describe('nouvelle version et historique', () => {
  it('copie axes, objectifs et rattachements ; l’ancienne reste VALIDEE tant que la nouvelle n’est pas validée', async () => {
    seed('VALIDEE')
    db.rattachements.push({ id: 'r0', organizationId: 'o1', axeId: 'a1', sourceType: 'AUDIT', sourceId: 'c1', provenance: 'MANUEL', ajoutePar: 'u0', createdAt: new Date() })
    const res = await NOUVELLE_VERSION(req('POST'), ctx({ id: 's1' }))
    expect(res.status).toBe(201)
    expect(db.strategies.find(s => s.id === 's1')!.statut).toBe('VALIDEE')
    const v2 = db.strategies.find(s => s.versionPrecedenteId === 's1')!
    expect(v2).toMatchObject({ version: 2, statut: 'BROUILLON', organizationId: 'o1' })
    const axes = (v2.axes as { create: Row[] }).create
    expect(axes[0]).toMatchObject({ titre: 'Protéger', objectifs: { create: [{ titre: 'MFA' }] }, rattachements: { create: [{ organizationId: 'o1', sourceType: 'AUDIT', sourceId: 'c1' }] } })
  })
  it('nouvelle version d’un BROUILLON : 409', async () => {
    seed()
    expect((await NOUVELLE_VERSION(req('POST'), ctx({ id: 's1' }))).status).toBe(409)
  })
  it('historique : évolutions, écart avec le cadre validé, rattachements ajoutés depuis la validation', async () => {
    seed()
    await VALIDER(req('POST'), ctx({ id: 's1' }))
    cfg.strategieCadreFige = false
    await ADD_AXE(req('POST', { titre: 'Répondre', justification: 'Retour d’incident' }), ctx({ id: 's1' }))
    db.strategies[0].valideeLe = new Date(Date.now() - 1000)
    await RATTACHER(req('POST', { axeId: 'a1', sourceType: 'AUDIT', sourceId: 'c1', justification: 'x' }), ctx({ id: 's1' }))
    session.role = 'AUDITEUR'
    const j = await (await HISTORIQUE(req('GET'), ctx({ id: 's1' }))).json()
    expect(j.evolutions.map((e: Row) => e.type)).toEqual(['AJOUT_AXE', 'AJOUT_RATTACHEMENT'])
    expect(j.ecart.axes.ajoutes.map((a: Row) => a.titre)).toEqual(['Répondre'])
    expect(j.rattachementsDepuisValidation).toHaveLength(1)
  })
})

describe('identifiants internes (lien comptable / budgétaire)', () => {
  const ids = { referenceInterne: 'CC-4102', identifiantsExternes: [{ systeme: 'SAP', valeur: '4102' }] }
  it('création : acceptés, normalisés et renvoyés ; invalides → 400 identifiants_invalides', async () => {
    const j = await (await CREATE(req('POST', { titre: 'S', type: 'IT', referenceInterne: ' CC-4102 ', identifiantsExternes: ids.identifiantsExternes }))).json()
    expect(j.strategie).toMatchObject(ids)
    const ko = await CREATE(req('POST', { titre: 'S', type: 'IT', identifiantsExternes: [{ systeme: 'SAP', valeur: '1' }, { systeme: 'SAP', valeur: '2' }] }))
    expect(ko.status).toBe(400)
    expect((await ko.json()).error).toBe('identifiants_invalides')
    expect((await ADD_AXE(req('POST', { titre: 'A', referenceInterne: 5 }), ctx({ id: db.strategies[0].id as string }))).status).toBe(400)
  })
  it('stratégie VALIDEE, cadre figé : identifiants modifiables, tracés (IDENTIFIANTS) sans justification ; autres champs 409', async () => {
    seed('VALIDEE')
    const res = await PATCH_STRAT(req('PATCH', { referenceInterne: 'CC-9' }), ctx({ id: 's1' }))
    expect(res.status).toBe(200)
    expect(db.strategies[0].referenceInterne).toBe('CC-9')
    expect(db.evolutions[0]).toMatchObject({ type: 'IDENTIFIANTS', cibleId: 's1', avant: { referenceInterne: null }, apres: { referenceInterne: 'CC-9' }, auteurId: 'u1' })
    expect((await PATCH_STRAT(req('PATCH', { titre: 'Autre', referenceInterne: 'CC-10' }), ctx({ id: 's1' }))).status).toBe(409)
    expect(db.strategies[0].referenceInterne).toBe('CC-9')
  })
  it('axe et objectif d’une stratégie VALIDEE figée : identifiants modifiables et tracés', async () => {
    seed('VALIDEE')
    expect((await PATCH_AXE(req('PATCH', { identifiantsExternes: ids.identifiantsExternes }), ctx({ id: 's1', axeId: 'a1' }))).status).toBe(200)
    expect(db.axes[0].identifiantsExternes).toEqual(ids.identifiantsExternes)
    expect(db.evolutions[0]).toMatchObject({ type: 'IDENTIFIANTS', cibleId: 'a1', apres: { identifiantsExternes: ids.identifiantsExternes } })
    expect((await PATCH_OBJ(req('PATCH', { referenceInterne: 'BUD-1' }), ctx({ id: 's1', objectifId: 'ob1' }))).status).toBe(200)
    expect(db.evolutions[1]).toMatchObject({ type: 'IDENTIFIANTS', cibleId: 'ob1' })
    // Mélangé à un champ du cadre figé : 409, rien d'écrit.
    expect((await PATCH_AXE(req('PATCH', { titre: 'X', referenceInterne: 'Z' }), ctx({ id: 's1', axeId: 'a1' }))).status).toBe(409)
    expect(db.axes[0].referenceInterne).toBeUndefined()
  })
  it('BROUILLON : modification sans historique ; instantané et nouvelle version copient les identifiants', async () => {
    seed()
    Object.assign(db.strategies[0], ids); Object.assign(db.axes[0], ids); Object.assign(db.objectifs[0], ids)
    expect((await PATCH_STRAT(req('PATCH', { referenceInterne: 'CC-4102' }), ctx({ id: 's1' }))).status).toBe(200)
    expect(db.evolutions).toHaveLength(0)
    session.role = 'RSSI'
    await VALIDER(req('POST'), ctx({ id: 's1' }))
    const snap = db.strategies[0].cadreValide as { strategie: Row; axes: Row[] }
    expect(snap.strategie).toEqual(ids)
    expect(snap.axes[0]).toMatchObject(ids)
    await NOUVELLE_VERSION(req('POST'), ctx({ id: 's1' }))
    const v2 = db.strategies.find(s => s.versionPrecedenteId === 's1')!
    expect(v2).toMatchObject(ids)
    const axes = (v2.axes as { create: Row[] }).create
    expect(axes[0]).toMatchObject({ ...ids, objectifs: { create: [ids] } })
  })
})

describe('lot S1a-fix : version de référence conservée jusqu’à la validation de la suivante', () => {
  it('un 2e brouillon sur la même version : 409 version_en_cours', async () => {
    seed('VALIDEE')
    expect((await NOUVELLE_VERSION(req('POST'), ctx({ id: 's1' }))).status).toBe(201)
    const res = await NOUVELLE_VERSION(req('POST'), ctx({ id: 's1' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('version_en_cours')
    expect(db.strategies.filter(s => s.versionPrecedenteId === 's1')).toHaveLength(1)
  })
  it('RISK_MANAGER supprime le brouillon v2 : la v1 reste VALIDEE', async () => {
    seed('VALIDEE')
    session.role = 'RISK_MANAGER'
    await NOUVELLE_VERSION(req('POST'), ctx({ id: 's1' }))
    const v2 = db.strategies.find(s => s.versionPrecedenteId === 's1')!
    expect((await DELETE_STRAT(req('DELETE'), ctx({ id: v2.id as string }))).status).toBe(200)
    expect(db.strategies.find(s => s.id === 's1')!.statut).toBe('VALIDEE')
  })
  it('validation de la v2 : la v1 passe ARCHIVEE dans la même transaction, journalisée STRATEGIE_ARCHIVED', async () => {
    seed('VALIDEE')
    await NOUVELLE_VERSION(req('POST'), ctx({ id: 's1' }))
    const v2 = db.strategies.find(s => s.versionPrecedenteId === 's1')!
    expect((await VALIDER(req('POST'), ctx({ id: v2.id as string }))).status).toBe(200)
    expect(v2.statut).toBe('VALIDEE')
    expect(db.strategies.find(s => s.id === 's1')!.statut).toBe('ARCHIVEE')
    expect(audit).toHaveBeenCalledWith('STRATEGIE_ARCHIVED', expect.objectContaining({ targetId: 's1' }))
  })
  it('archivage direct : journalisé STRATEGIE_ARCHIVED', async () => {
    seed('VALIDEE')
    expect((await ARCHIVER(req('POST'), ctx({ id: 's1' }))).status).toBe(200)
    expect(audit).toHaveBeenCalledWith('STRATEGIE_ARCHIVED', expect.objectContaining({ targetId: 's1' }))
  })
})

describe('lot S1a-fix : décision prise sous verrou de la ligne Strategie', () => {
  it('helper : verrou FOR UPDATE dans l’organisation ; stratégie absente → 404 sans appeler la suite', async () => {
    seed()
    const fn = vi.fn(async () => 'ok')
    expect(await sousVerrouStrategie('o1', 's1', fn)).toBe('ok')
    const appel = vi.mocked(prismaMock.$queryRaw).mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]]
    expect(appel[0].join('?')).toMatch(/SELECT id, statut FROM "Strategie" WHERE id = \? AND "organizationId" = \? FOR UPDATE/)
    expect(appel.slice(1)).toEqual(['s1', 'o1'])
    expect(fn).toHaveBeenCalledWith(prismaMock, expect.objectContaining({ id: 's1', statut: 'BROUILLON' }))
    fn.mockClear()
    const r = await sousVerrouStrategie('o1', 'sX', fn)
    expect(fn).not.toHaveBeenCalled()
    expect((r as { erreur: Response }).erreur.status).toBe(404)
  })
  it('modification d’axe : archivée entre la lecture et la transaction → 409, rien d’écrit', async () => {
    seed('VALIDEE')
    cfg.strategieCadreFige = false
    course.avant = () => { db.strategies[0].statut = 'ARCHIVEE' }
    const res = await PATCH_AXE(req('PATCH', { titre: 'Protéger mieux', justification: 'NIS2' }), ctx({ id: 's1', axeId: 'a1' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('strategie_archivee')
    expect(db.axes[0].titre).toBe('Protéger')
    expect(db.evolutions).toHaveLength(0)
  })
  it('ajout d’axe et rattachement : validée entre-temps → historisés (justification exigée)', async () => {
    seed()
    cfg.strategieCadreFige = false
    course.avant = () => { db.strategies[0].statut = 'VALIDEE' }
    const r = await ADD_AXE(req('POST', { titre: 'Détecter' }), ctx({ id: 's1' }))
    expect(r.status).toBe(400)
    expect(db.axes).toHaveLength(2)
    db.strategies[0].statut = 'BROUILLON'
    course.avant = () => { db.strategies[0].statut = 'VALIDEE' }
    expect((await RATTACHER(req('POST', { axeId: 'a1', sourceType: 'AUDIT', sourceId: 'c1' }), ctx({ id: 's1' }))).status).toBe(400)
    expect(db.rattachements).toHaveLength(0)
  })
  it('validation : l’instantané est pris sous verrou (axe ajouté juste avant inclus)', async () => {
    seed()
    course.avant = () => { db.axes.push({ id: 'a2', strategieId: 's1', ordre: 1, titre: 'Détecter', description: null, referenceRef: null }) }
    expect((await VALIDER(req('POST'), ctx({ id: 's1' }))).status).toBe(200)
    expect((db.strategies[0].cadreValide as { axes: Row[] }).axes.map(a => a.id)).toEqual(['a1', 'a2'])
  })
  it('nouvelle version : le plan est chargé sous verrou', async () => {
    seed('VALIDEE')
    course.avant = () => { db.axes.push({ id: 'a2', strategieId: 's1', ordre: 1, titre: 'Détecter', description: null, referenceRef: null }) }
    expect((await NOUVELLE_VERSION(req('POST'), ctx({ id: 's1' }))).status).toBe(201)
    const v2 = db.strategies.find(s => s.versionPrecedenteId === 's1')!
    expect((v2.axes as { create: Row[] }).create.map(a => a.titre)).toEqual(['Protéger', 'Détecter'])
  })
})

describe('lot S1a-fix : suppression d’un axe après validation', () => {
  it('VALIDEE non figée : axe non vide → 409 axe_non_vide, rien d’effacé ; axe vide → supprimé et tracé', async () => {
    seed('VALIDEE')
    cfg.strategieCadreFige = false
    const res = await DELETE_AXE(req('DELETE', { justification: 'Recentrage' }), ctx({ id: 's1', axeId: 'a1' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('axe_non_vide')
    expect(db.axes.find(a => a.id === 'a1')).toBeTruthy()
    // Axe sans objectif mais avec un rattachement : non vide aussi.
    db.axes.push({ id: 'a2', strategieId: 's1', ordre: 1, titre: 'Détecter', description: null, referenceRef: null })
    db.rattachements.push({ id: 'r0', organizationId: 'o1', axeId: 'a2', sourceType: 'AUDIT', sourceId: 'c1', provenance: 'MANUEL', ajoutePar: 'u0' })
    expect((await DELETE_AXE(req('DELETE', { justification: 'x' }), ctx({ id: 's1', axeId: 'a2' }))).status).toBe(409)
    db.axes.push({ id: 'a3', strategieId: 's1', ordre: 2, titre: 'Répondre', description: null, referenceRef: null })
    expect((await DELETE_AXE(req('DELETE', { justification: 'Doublon' }), ctx({ id: 's1', axeId: 'a3' }))).status).toBe(200)
    expect(db.evolutions).toEqual([expect.objectContaining({ type: 'SUPPR_AXE', cibleId: 'a3', justification: 'Doublon' })])
  })
  it('BROUILLON : axe non vide supprimé librement', async () => {
    seed()
    expect((await DELETE_AXE(req('DELETE'), ctx({ id: 's1', axeId: 'a1' }))).status).toBe(200)
  })
})

describe('lot S1a-fix : KRI d’un objectif vérifié dans l’organisation', () => {
  it('POST et PATCH : KRI d’une autre organisation → 404 kri_introuvable ; KRI de l’org accepté', async () => {
    seed()
    db.kris.push({ id: 'k1', organizationId: 'o1' }, { id: 'kX', organizationId: 'o2' })
    const ko = await ADD_OBJ(req('POST', { titre: 'EDR', kriId: 'kX' }), ctx({ id: 's1', axeId: 'a1' }))
    expect(ko.status).toBe(404)
    expect((await ko.json()).error).toBe('kri_introuvable')
    expect(db.objectifs).toHaveLength(1)
    expect((await ADD_OBJ(req('POST', { titre: 'EDR', kriId: 'k1' }), ctx({ id: 's1', axeId: 'a1' }))).status).toBe(201)
    const ko2 = await PATCH_OBJ(req('PATCH', { kriId: 'kX' }), ctx({ id: 's1', objectifId: 'ob1' }))
    expect(ko2.status).toBe(404)
    expect((await ko2.json()).error).toBe('kri_introuvable')
    expect(db.objectifs[0].kriId).toBeNull()
    expect((await PATCH_OBJ(req('PATCH', { kriId: 'k1' }), ctx({ id: 's1', objectifId: 'ob1' }))).status).toBe(200)
    expect(db.objectifs[0].kriId).toBe('k1')
    expect((await PATCH_OBJ(req('PATCH', { kriId: null }), ctx({ id: 's1', objectifId: 'ob1' }))).status).toBe(200)
  })
})
