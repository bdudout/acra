/** Bibliothèque documentaire : les fichiers des projets 360 n'y apparaissent pas et n'y sont ni téléchargeables ni supprimables. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ document: { findMany: vi.fn(async (_a: { where: object }) => [] as unknown[]), findFirst: vi.fn(async (_a: { where: object }) => null as unknown), delete: vi.fn() } }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'RSSI' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(async () => ({ role: 'RSSI', activeOrgId: 'o' })) }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ conformiteActive: true })) }))
vi.mock('@/lib/document-storage', () => ({ getDocumentStorage: async () => ({ get: vi.fn(), delete: vi.fn() }) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '' }))

import { GET } from '@/app/api/documents/route'
import { GET as DOWNLOAD } from '@/app/api/documents/[id]/download/route'
import { DELETE } from '@/app/api/documents/[id]/route'

beforeEach(() => vi.clearAllMocks())
describe('GED et fichiers de projet', () => {
  it('liste, téléchargement, suppression : analyseId nul exigé', async () => {
    await GET({ url: 'http://x/api/documents' } as never)
    expect(db.document.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'o', analyseId: null })
    const p = { params: Promise.resolve({ id: 'd1' }) }
    expect((await DOWNLOAD({ headers: new Headers() } as never, p)).status).toBe(404)
    expect(db.document.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'd1', organizationId: 'o', analyseId: null })
    expect((await DELETE({ headers: new Headers() } as never, p)).status).toBe(404)
    expect(db.document.findFirst.mock.calls[1][0].where).toMatchObject({ id: 'd1', analyseId: null })
  })
})
