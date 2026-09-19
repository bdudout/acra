import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'demo-admin', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organizationConfig: {
      upsert: vi.fn(async ({ create }) => create),
      findUnique: vi.fn(),
    },
    configuration: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/org-context.server', () => ({
  getAnalyseScope: vi.fn(async () => ({ activeOrgId: 'own-demo-org', role: 'ADMIN' })),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn() }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ LIMIT_SEARCH: { limit: 60, windowMs: 60_000 }, rateLimit: vi.fn(() => ({ allowed: true })), rateLimitHeaders: vi.fn() }))

import { PUT } from '@/app/api/admin/organization-config/route'
import { prisma } from '@/lib/prisma'

beforeEach(() => vi.clearAllMocks())

it('autorise l’ADMIN effectif de sa propre organisation, même si son rôle d’instance est ANALYSTE', async () => {
  const response = await PUT(new Request('http://localhost/api/admin/organization-config', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conseilsAteliersActive: false }),
  }) as never)

  expect(response.status).toBe(200)
  expect(vi.mocked(prisma.organizationConfig.upsert)).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'own-demo-org' },
  }))
})
