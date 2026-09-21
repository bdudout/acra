/**
 * Tests IDOR continus — isolation cross-organisation des ressources scopées par ANALYSE.
 *
 * Complément de `org-resource-scope*.route.test.ts` (ressources /organizations/[orgId]).
 * Les routes `/api/analyses/[id]/**` gardent le périmètre autrement : elles chargent
 * l'analyse via `prisma.analyse.findFirst({ where: analyseAccessWhere(user, role, id) })`.
 * Pour une analyse appartenant à une AUTRE organisation (non possédée, non partagée,
 * hors périmètre), la clause ne la ramène pas → l'analyse est « introuvable » (404),
 * AVANT toute lecture détaillée ou mutation. On ne divulgue pas son existence.
 *
 * Scénario « deux comptes / deux organisations » : le compte cible l'analyse d'une
 * autre org → `findFirst` renvoie null → 404. Vérifié sur toutes les mutations
 * (et GET) analyse-scopées non déjà couvertes ailleurs.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'

// `vi.mock` est hoisté : les mocks référencés dans sa factory doivent l'être aussi.
const { findFirst, findUnique } = vi.hoisted(() => ({
  findFirst: vi.fn(async () => null),
  findUnique: vi.fn(async () => null),
}))

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { analyse: { findFirst, findUnique } } }))
vi.mock('@/lib/org-context.server', () => ({
  analyseAccessWhere: vi.fn(async () => ({})),
  getEffectiveRoleForOrg: vi.fn(async () => null),
  getAnalyseScope: vi.fn(async () => ({ scope: { visibleOrgIds: [], isSuperAdmin: false } })),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({})) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '' }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 }),
  rateLimitHeaders: () => ({}),
  LIMIT_API_WRITE: { limit: 100, windowMs: 60_000 },
}))

import { GET as rootGet, PATCH as rootPatch, DELETE as rootDelete } from '@/app/api/analyses/[id]/route'
import { PUT as workshopPut } from '@/app/api/analyses/[id]/workshop/[num]/route'
import { GET as revisionsGet, POST as revisionsPost } from '@/app/api/analyses/[id]/revisions/route'
import { GET as derogGet, POST as derogPost } from '@/app/api/analyses/[id]/derogations/route'
import { PATCH as confPatch } from '@/app/api/analyses/[id]/conformite/route'
import { GET as accessGet, POST as accessPost, DELETE as accessDelete } from '@/app/api/analyses/[id]/access/route'

type Handler = (req: never, ctx: never) => Promise<Response>

const RESOURCES: Record<string, { handler: Handler; method: string }> = {
  'analyse GET':               { handler: rootGet as Handler, method: 'GET' },
  'analyse PATCH':             { handler: rootPatch as Handler, method: 'PATCH' },
  'analyse DELETE':            { handler: rootDelete as Handler, method: 'DELETE' },
  'workshop/[num] PUT':        { handler: workshopPut as Handler, method: 'PUT' },
  'revisions GET':             { handler: revisionsGet as Handler, method: 'GET' },
  'revisions POST':            { handler: revisionsPost as Handler, method: 'POST' },
  'derogations GET':           { handler: derogGet as Handler, method: 'GET' },
  'derogations POST':          { handler: derogPost as Handler, method: 'POST' },
  'conformite PATCH':          { handler: confPatch as Handler, method: 'PATCH' },
  'access GET':                { handler: accessGet as Handler, method: 'GET' },
  'access POST':               { handler: accessPost as Handler, method: 'POST' },
  'access DELETE':             { handler: accessDelete as Handler, method: 'DELETE' },
}

beforeEach(() => {
  vi.clearAllMocks()
  findFirst.mockResolvedValue(null as never)
  findUnique.mockResolvedValue(null as never)
})

describe('IDOR — analyse d\'une autre organisation invisible (404) avant toute mutation', () => {
  for (const [name, { handler, method }] of Object.entries(RESOURCES)) {
    it(`${name} renvoie 404 pour une analyse étrangère`, async () => {
      const req = new Request('http://localhost/api?membershipId=x', {
        method,
        ...(method === 'GET' || method === 'DELETE'
          ? {}
          : { body: JSON.stringify({ email: 'x@y.z', statut: 'conforme', num: 1 }), headers: { 'content-type': 'application/json' } }),
      })
      const ctx = { params: Promise.resolve({ id: 'foreign', num: '1' }) }
      const res = await handler(req as never, ctx as never)
      expect(res.status).toBe(404)
    })
  }
})
