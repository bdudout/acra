/** Reçu d'import v2 (GET ?format=csv) : cloisonné par org de la clé, cellules neutralisées. */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api-auth.server', () => ({ authenticateApiRequest: vi.fn(async () => ({ ok: true, organizationId: 'orgA', scopes: ['read'], keyId: 'k1', actorUserId: 'u1' })) }))
const findFirst = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { analysisImport: { findFirst: (...a: unknown[]) => findFirst(...a) } } }))

import { GET } from '@/app/api/v2/analysis-imports/[id]/route'

const req = (format?: string) => ({ nextUrl: new URL(`http://x/api/v2/analysis-imports/i1${format ? `?format=${format}` : ''}`) }) as never
const P = { params: Promise.resolve({ id: 'i1' }) }

describe('GET /api/v2/analysis-imports/[id]', () => {
  it('neutralise une formule injectée via le nom d’analyse importé', async () => {
    findFirst.mockResolvedValue({ id: 'i1', analyseId: 'an1', source: 'API_V2', createdAt: new Date(), response: { nom: '=HYPERLINK("http://evil","x")', created: { risks: 2 } } })
    const csv = await (await GET(req('csv'), P)).text()
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`)
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m)
  })

  it('recherche le reçu dans l’organisation de la clé uniquement', async () => {
    findFirst.mockResolvedValue(null)
    expect((await GET(req(), P)).status).toBe(404)
    expect((findFirst.mock.calls.at(-1)?.[0] as { where: unknown }).where).toEqual({ id: 'i1', organizationId: 'orgA' })
  })
})
