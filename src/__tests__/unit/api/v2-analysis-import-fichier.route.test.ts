// @vitest-environment node
// B-IMP-72 — API v2 « fichier + profil » en multipart/form-data : aperçu avec les états des lignes (B-IMP-53) et import
// idempotent ; profil référencé (prioritaire) ou fourni dans la requête ; le JSON (paquet canonique) reste accepté.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  auth: vi.fn(), rl: vi.fn(), audit: vi.fn(), mappings: vi.fn(), execute: vi.fn(),
}))
vi.mock('@/lib/api-auth.server', () => ({ authenticateApiRequest: m.auth }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, rateLimitHeaders: () => ({}), LIMIT_EXCEL_PARSE: { limit: 30, windowMs: 600_000 } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/prisma', () => ({ prisma: { analysisImportMapping: { findMany: m.mappings } } }))
vi.mock('@/lib/configuration-server', () => ({ getEffectiveScaleConfig: vi.fn(async () => ({})) }))
vi.mock('@/lib/analysis-import', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/analysis-import')>()), executeAnalysisImport: m.execute }))
import { POST as PREVIEW } from '@/app/api/v2/analysis-imports/preview/route'
import { POST as IMPORT } from '@/app/api/v2/analysis-imports/route'

const CSV = 'Réf;Risque;Gravité;Vraisemblance\nR1;Fraude au virement;3;2\nR2;;2;2\nR3;Panne du datacenter;4;1\n'
const form = (fields: Record<string, string>, csv = CSV, nom = 'registre.csv') => {
  const f = new FormData()
  f.set('file', new File([csv], nom, { type: 'text/csv' }))
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return new NextRequest('http://x/api/v2/analysis-imports', { method: 'POST', body: f })
}

beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ ok: true, organizationId: 'orgA', scopes: ['write'], keyId: 'k1', actorUserId: 'u1' })
  m.rl.mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 })
  m.mappings.mockResolvedValue([])
  m.execute.mockImplementation(async () => ({ replayed: false, analyseId: 'an1', importId: 'imp1', created: { risks: 2 }, warnings: [] }))
})

describe('POST /api/v2/analysis-imports/preview — fichier', () => {
  it('sans profil : détection automatique, états des lignes et volumes, rien n’est écrit', async () => {
    const res = await PREVIEW(form({}))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j).toMatchObject({ valid: true, mode: 'FILE', profile: { source: 'AUTO' } })
    expect(j.lines).toEqual({ pret: 2, sansCeChamp: 0, aConfirmer: 1, nonImportable: 0, ignorees: 0 })
    expect(j.sheets[0]).toMatchObject({ name: 'registre', role: 'RISKS' })
    expect(j.decisions.some((d: { row: number; status: string }) => d.status === 'REJECTED')).toBe(true)
    expect(m.execute).not.toHaveBeenCalled()
  })
  it('profil référencé inconnu : 400 explicite ; mapping enregistré cherché dans l’organisation de la clé seulement', async () => {
    const res = await PREVIEW(form({ profileRef: 'Format inconnu' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('profil_introuvable')
    expect(m.mappings.mock.calls[0][0].where).toEqual({ OR: [{ organizationId: 'orgA' }, { organizationId: null }] })
  })
  it('format refusé (.xls) et débit dépassé', async () => {
    expect((await (await PREVIEW(form({}, 'x', 'ancien.xls'))).json()).error).toBeTruthy()
    m.rl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 })
    expect((await PREVIEW(form({}))).status).toBe(429)
  })
})

describe('POST /api/v2/analysis-imports — fichier', () => {
  it('importe les lignes prêtes avec la clé d’idempotence fournie ; clé absente → 400', async () => {
    expect((await IMPORT(form({}))).status).toBe(400)
    const res = await IMPORT(form({ idempotencyKey: 'flux-registre-2026-10' }))
    expect(res.status).toBe(201)
    const pkg = m.execute.mock.calls[0][0] as { idempotencyKey: string; risks: { title: string }[] }
    expect(pkg.idempotencyKey).toBe('flux-registre-2026-10')
    expect(pkg.risks.map(r => r.title)).toEqual(['Fraude au virement', 'Panne du datacenter'])
    expect(m.execute.mock.calls[0][1]).toMatchObject({ organizationId: 'orgA', userId: 'u1', source: 'API_V2' })
    expect((await res.json()).lines).toMatchObject({ pret: 2, aConfirmer: 1 })
  })
  it('clé réutilisée avec un autre contenu : 409 inchangé', async () => {
    m.execute.mockRejectedValue(new Error('IDEMPOTENCY_KEY_REUSED'))
    expect((await IMPORT(form({ idempotencyKey: 'flux-registre-2026-10' }))).status).toBe(409)
  })
})
