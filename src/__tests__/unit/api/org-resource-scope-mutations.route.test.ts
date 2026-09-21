/**
 * Tests IDOR continus — isolation cross-organisation des MUTATIONS org-scopées.
 *
 * Pendant de `org-resource-scope.route.test.ts` (qui couvre les GET via
 * `getAnalyseScope`), ce fichier couvre les écritures (POST/PATCH/DELETE) et les
 * GET restants, qui gardent le périmètre via `getEffectiveRoleForOrg` : un
 * utilisateur authentifié mais SANS appartenance effective à l'organisation cible
 * (rôle résolu = null) doit être refusé (403) AVANT toute lecture/écriture métier.
 *
 * Scénario « deux comptes / deux organisations » : le compte appartient à l'org A
 * et cible l'org B (étrangère) → `getEffectiveRoleForOrg(..., B)` renvoie null.
 * On vérifie que chaque ressource sensible refuse (403) et ne touche jamais la DB
 * (prisma est un objet vide : toute requête lèverait).
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(), getEffectiveRoleForOrg: vi.fn() }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ conformiteActive: true })) }))
vi.mock('@/lib/referentiel.server', () => ({ getExigencesFor: vi.fn(), listReferentiels: vi.fn() }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '' }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 }),
  rateLimitHeaders: () => ({}),
  LIMIT_API_WRITE: { limit: 100, windowMs: 60_000 },
}))

import { getAnalyseScope, getEffectiveRoleForOrg } from '@/lib/org-context.server'

import { GET as importGet, POST as importPost } from '@/app/api/organizations/[orgId]/conformite/import/route'
import { POST as confPost, PATCH as confPatch, DELETE as confDelete } from '@/app/api/organizations/[orgId]/conformite/route'
import { POST as traitPost } from '@/app/api/organizations/[orgId]/conformite/traitements/route'
import { PATCH as traitIdPatch, DELETE as traitIdDelete } from '@/app/api/organizations/[orgId]/conformite/traitements/[id]/route'
import { GET as entitesGet, POST as entitesPost } from '@/app/api/organizations/[orgId]/entites/route'
import { GET as membresGet, POST as membresPost, DELETE as membresDelete } from '@/app/api/organizations/[orgId]/entites/[entiteId]/membres/route'
import { POST as plansPost } from '@/app/api/organizations/[orgId]/plans-actions/route'
import { PATCH as plansIdPatch, DELETE as plansIdDelete } from '@/app/api/organizations/[orgId]/plans-actions/[id]/route'

type Handler = (req: never, ctx: never) => Promise<Response>

// Ressource sensible → { handler, méthode HTTP }. `id`/`entiteId` superflus sont ignorés.
const RESOURCES: Record<string, { handler: Handler; method: string }> = {
  'conformite/import GET':            { handler: importGet as Handler, method: 'GET' },
  'conformite/import POST':           { handler: importPost as Handler, method: 'POST' },
  'conformite POST':                  { handler: confPost as Handler, method: 'POST' },
  'conformite PATCH':                 { handler: confPatch as Handler, method: 'PATCH' },
  'conformite DELETE':                { handler: confDelete as Handler, method: 'DELETE' },
  'conformite/traitements POST':      { handler: traitPost as Handler, method: 'POST' },
  'conformite/traitements/[id] PATCH':  { handler: traitIdPatch as Handler, method: 'PATCH' },
  'conformite/traitements/[id] DELETE': { handler: traitIdDelete as Handler, method: 'DELETE' },
  'entites GET':                      { handler: entitesGet as Handler, method: 'GET' },
  'entites POST':                     { handler: entitesPost as Handler, method: 'POST' },
  'entites/[entiteId]/membres GET':    { handler: membresGet as Handler, method: 'GET' },
  'entites/[entiteId]/membres POST':   { handler: membresPost as Handler, method: 'POST' },
  'entites/[entiteId]/membres DELETE': { handler: membresDelete as Handler, method: 'DELETE' },
  'plans-actions POST':               { handler: plansPost as Handler, method: 'POST' },
  'plans-actions/[id] PATCH':          { handler: plansIdPatch as Handler, method: 'PATCH' },
  'plans-actions/[id] DELETE':         { handler: plansIdDelete as Handler, method: 'DELETE' },
}

beforeEach(() => {
  vi.clearAllMocks()
  // Le compte cible une organisation à laquelle il n'appartient pas → aucun rôle effectif.
  vi.mocked(getEffectiveRoleForOrg).mockResolvedValue(null as never)
  // Certaines routes lisent aussi le périmètre de visibilité : org étrangère hors liste.
  vi.mocked(getAnalyseScope).mockResolvedValue({ scope: { visibleOrgIds: ['own'], isSuperAdmin: false } } as never)
})

describe('IDOR — refus cross-organisation sur les ressources org sensibles', () => {
  for (const [name, { handler, method }] of Object.entries(RESOURCES)) {
    it(`${name} refuse une organisation étrangère (403) sans toucher la DB`, async () => {
      const req = new Request('http://localhost/api?referentiel=ISO27001&membershipId=x', {
        method,
        ...(method === 'GET' || method === 'DELETE' ? {} : { body: '{}', headers: { 'content-type': 'application/json' } }),
      })
      const ctx = { params: Promise.resolve({ orgId: 'foreign', id: 'x', entiteId: 'x' }) }
      const res = await handler(req as never, ctx as never)
      expect(res.status).toBe(403)
    })
  }
})
