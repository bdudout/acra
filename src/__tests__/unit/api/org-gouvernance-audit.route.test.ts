/**
 * Journal d'audit des écritures de gouvernance d'une organisation (2026-10-16) :
 * plans d'action unifiés et suivis de conformité (arrêt, reprise, traitements d'écarts).
 * Auparavant, supprimer un suivi de conformité ou un plan d'action ne laissait aucune trace.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/with-access.server', () => ({
  withAccess: (_opts: unknown, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    async (req: NextRequest, route: { params: Promise<Record<string, string>> }) =>
      handler(req, { user: { id: 'u1', role: 'RSSI', email: 'u@x', name: null }, role: 'RSSI', orgId: 'orgA', scope: null, params: await route.params, body: undefined, rl: null }),
}))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '10.0.0.1' }))
vi.mock('@/lib/entites.server', () => ({ entiteIdPourTexte: vi.fn(async () => null) }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ conformiteActive: true, conformiteNiveau: 'ORGANISATION' })) }))
vi.mock('@/lib/conformite-config', async (orig) => ({ ...(await orig<object>()), usesConformiteEntity: () => true }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    planAction: {
      create: vi.fn(async () => ({ id: 'pa1', titre: 'T', liens: [] })),
      findFirst: vi.fn(async () => ({ id: 'pa1' })),
      update: vi.fn(async () => ({ id: 'pa1', liens: [] })),
      delete: vi.fn(async () => ({ id: 'pa1' })),
    },
    conformite: { deleteMany: vi.fn(async () => ({ count: 1 })), upsert: vi.fn(async () => ({})) },
    conformiteTraitement: {
      create: vi.fn(async () => ({ id: 't1', type: 'PLAN_ACTION', intitule: 'I', refs: [], statut: 'EN_COURS' })),
      findFirst: vi.fn(async () => ({ id: 't1', refs: [] })),
      update: vi.fn(async () => ({ id: 't1' })),
      delete: vi.fn(async () => ({ id: 't1' })),
    },
    analyse: { findFirst: vi.fn(async () => ({ referentielMesures: 'ISO27001', cadrage: { socleSecurite: [{ ref: 'A.5.1', statut: 'conforme' }] } })) },
  },
}))

import { auditLog } from '@/lib/logger'
import { POST as planPost } from '@/app/api/organizations/[orgId]/plans-actions/route'
import { PATCH as planPatch, DELETE as planDelete } from '@/app/api/organizations/[orgId]/plans-actions/[id]/route'
import { DELETE as confDelete } from '@/app/api/organizations/[orgId]/conformite/route'
import { POST as importPost } from '@/app/api/organizations/[orgId]/conformite/import/route'
import { POST as traitPost } from '@/app/api/organizations/[orgId]/conformite/traitements/route'
import { PATCH as traitPatch, DELETE as traitDelete } from '@/app/api/organizations/[orgId]/conformite/traitements/[id]/route'

const req = (method: string, body?: unknown, qs = '') =>
  new NextRequest(`http://localhost/api/x${qs}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) })
const route = (p: Record<string, string>) => ({ params: Promise.resolve(p) })

/** Dernière entrée de journal : action + organisation + auteur + détail. */
function lastAudit() {
  const call = vi.mocked(auditLog).mock.lastCall
  expect(call, 'aucune entrée de journal').toBeDefined()
  return { action: call![0], meta: call![1] as Record<string, unknown> & { details?: Record<string, unknown> } }
}

beforeEach(() => vi.mocked(auditLog).mockClear())

describe('plans d\'action unifiés — journal d\'audit', () => {
  it('création', async () => {
    const res = await planPost(req('POST', { titre: 'Durcir le VPN' }), route({ orgId: 'orgA' }))
    expect(res.status).toBe(201)
    const a = lastAudit()
    expect(a.action).toBe('PLAN_ACTION_UPDATED')
    expect(a.meta).toMatchObject({ userId: 'u1', organizationId: 'orgA', targetId: 'pa1', targetType: 'plan_action', details: { action: 'create' } })
  })
  it('modification (champs modifiés seulement)', async () => {
    await planPatch(req('PATCH', { titre: 'X', statut: 'FAIT' }), route({ orgId: 'orgA', id: 'pa1' }))
    expect(lastAudit()).toMatchObject({ action: 'PLAN_ACTION_UPDATED', meta: { targetId: 'pa1', details: { action: 'update', champs: ['titre', 'statut'] } } })
  })
  it('suppression', async () => {
    await planDelete(req('DELETE'), route({ orgId: 'orgA', id: 'pa1' }))
    expect(lastAudit()).toMatchObject({ action: 'PLAN_ACTION_UPDATED', meta: { targetId: 'pa1', details: { action: 'delete' } } })
  })
})

describe('conformité d\'organisation — journal d\'audit', () => {
  it('arrêt d\'un suivi (suppression du suivi et de ses versions)', async () => {
    await confDelete(req('DELETE', undefined, '?referentiel=ISO27001&entite=Siège'), route({ orgId: 'orgA' }))
    expect(lastAudit()).toMatchObject({ action: 'CONFORMITE_UPDATED', meta: { organizationId: 'orgA', details: { action: 'suivi-delete', referentiel: 'ISO27001', entite: 'Siège' } } })
  })
  it('reprise de la conformité d\'une analyse (écrase le suivi)', async () => {
    await importPost(req('POST', { referentiel: 'ISO27001', analyseId: 'an1' }), route({ orgId: 'orgA' }))
    expect(lastAudit()).toMatchObject({ action: 'CONFORMITE_UPDATED', meta: { details: { action: 'import', referentiel: 'ISO27001', analyseId: 'an1', imported: 1 } } })
  })
  it('traitements d\'écart : création, modification, suppression', async () => {
    await traitPost(req('POST', { referentiel: 'ISO27001', type: 'PLAN_ACTION', intitule: 'I' }), route({ orgId: 'orgA' }))
    expect(lastAudit()).toMatchObject({ action: 'CONFORMITE_UPDATED', meta: { targetId: 't1', details: { action: 'traitement-create', type: 'PLAN_ACTION' } } })
    await traitPatch(req('PATCH', { statut: 'CLOTURE' }), route({ orgId: 'orgA', id: 't1' }))
    expect(lastAudit()).toMatchObject({ action: 'CONFORMITE_UPDATED', meta: { targetId: 't1', details: { action: 'traitement-update' } } })
    await traitDelete(req('DELETE'), route({ orgId: 'orgA', id: 't1' }))
    expect(lastAudit()).toMatchObject({ action: 'CONFORMITE_UPDATED', meta: { targetId: 't1', details: { action: 'traitement-delete' } } })
  })
})
