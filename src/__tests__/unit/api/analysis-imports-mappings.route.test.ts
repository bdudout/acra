// @vitest-environment node
/** Mappings d'import enregistrés : ceux de l'organisation + le mapping par défaut d'instance (organizationId nul), lecture seule. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), role: vi.fn(), findMany: vi.fn(), upsert: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope, getEffectiveRoleForOrg: m.role }))
vi.mock('@/lib/prisma', () => ({ prisma: { analysisImportMapping: { findMany: m.findMany, upsert: m.upsert } } }))
import { GET, POST } from '@/app/api/analysis-imports/mappings/route'

const stored = { version: 2, mappings: { Risques: { title: 'Titre' } }, sheetTypes: { Risques: 'RISKS' }, transforms: {}, statusMappings: {}, scoreMappings: {} }

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'org1' })
  m.role.mockResolvedValue('ANALYSTE')
})

describe('GET /api/analysis-imports/mappings', () => {
  it('liste les mappings de l’organisation ET le défaut d’instance (organizationId nul), ce dernier marqué « builtin »', async () => {
    m.findMany.mockResolvedValue([
      { id: 'a', name: 'mapping_mzt', organizationId: null, mappings: stored, updatedAt: new Date() },
      { id: 'b', name: 'mon mapping', organizationId: 'org1', mappings: stored, updatedAt: new Date() },
    ])
    const res = await GET(new NextRequest('http://x/api/analysis-imports/mappings'))
    expect(res.status).toBe(200)
    expect(m.findMany.mock.calls[0][0].where).toEqual({ OR: [{ organizationId: 'org1' }, { organizationId: null }] })
    const { mappings } = await res.json()
    expect(mappings.map((x: { name: string; builtin: boolean }) => [x.name, x.builtin])).toEqual([['mapping_mzt', true], ['mon mapping', false]])
    expect(mappings[0].sheetTypes).toEqual({ Risques: 'RISKS' })
  })
  it('sans droit de création d’analyse : 403', async () => {
    m.role.mockResolvedValue('LECTEUR')
    expect((await GET(new NextRequest('http://x/api/analysis-imports/mappings'))).status).toBe(403)
  })
})

describe('POST /api/analysis-imports/mappings', () => {
  it('enregistre toujours pour l’organisation ciblée : un mapping d’instance n’est jamais écrasé', async () => {
    m.upsert.mockResolvedValue({ id: 'c', name: 'mapping_mzt', organizationId: 'org1', mappings: stored, updatedAt: new Date() })
    const res = await POST(new NextRequest('http://x/api/analysis-imports/mappings', { method: 'POST', body: JSON.stringify({ name: 'mapping_mzt', mappings: stored.mappings, sheetTypes: stored.sheetTypes }) }))
    expect(res.status).toBe(201)
    expect(m.upsert.mock.calls[0][0].where).toEqual({ organizationId_name: { organizationId: 'org1', name: 'mapping_mzt' } })
    expect(m.upsert.mock.calls[0][0].create.organizationId).toBe('org1')
  })
})

describe('alias de préfixe enregistrés avec le mapping', () => {
  it('POST conserve refAliases, GET les renvoie (mapping livré : « R » ⇒ « RI » validé d’avance)', async () => {
    m.upsert.mockResolvedValue({ id: 'c', name: 'x', organizationId: 'org1', mappings: { ...stored, refAliases: { 'PACS': { R: 'RI' } } }, updatedAt: new Date() })
    await POST(new NextRequest('http://x/api/analysis-imports/mappings', { method: 'POST', body: JSON.stringify({ name: 'x', mappings: stored.mappings, refAliases: { PACS: { R: 'RI' } } }) }))
    expect(m.upsert.mock.calls[0][0].create.mappings.refAliases).toEqual({ PACS: { R: 'RI' } })
    m.findMany.mockResolvedValue([{ id: 'a', name: 'mapping_mzt', organizationId: null, mappings: { ...stored, refAliases: { PACS: { R: 'RI' } } }, updatedAt: new Date() }])
    const { mappings } = await (await GET(new NextRequest('http://x/api/analysis-imports/mappings'))).json()
    expect(mappings[0].refAliases).toEqual({ PACS: { R: 'RI' } })
  })
})
