/** Processus de cartographie : registre inactif → 404 ; lecture pour les membres ; écriture gouvernance. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ role: 'RISK_MANAGER', active: true }))
const db = vi.hoisted(() => ({ organizationConfig: { upsert: vi.fn() } }))
const auditLog = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(async () => ({ role: state.role, activeOrgId: 'org1' })) }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ registreRisquesActive: state.active, processusCartographie: {} })), upsertOrgConfig: (id: string, data: object) => db.organizationConfig.upsert({ where: { id }, create: { id, ...data }, update: data }) }))
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: () => '' }))

import { PUT } from '@/app/api/cartographie/processus/route'
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as never

beforeEach(() => { vi.clearAllMocks(); Object.assign(state, { role: 'RISK_MANAGER', active: true }) })

describe('PUT /api/cartographie/processus', () => {
  it('registre inactif → 404 ; rôle hors gouvernance → 403', async () => {
    state.active = false
    expect((await PUT(req({}))).status).toBe(404)
    state.active = true; state.role = 'ANALYSTE'
    expect((await PUT(req({}))).status).toBe(403)
    expect(db.organizationConfig.upsert).not.toHaveBeenCalled()
  })

  it('enregistre la personnalisation assainie dans la config de l’organisation active', async () => {
    const res = await PUT(req({ periodicite: 'SEMESTRIELLE', etapes: [{ key: 'suivi', titre: 'Revue', description: 'Comité', inconnu: 1 }, { key: 'x' }] }))
    expect(res.status).toBe(200)
    const arg = db.organizationConfig.upsert.mock.calls[0][0]
    expect(arg.where).toEqual({ id: 'org1' })
    expect(arg.update.processusCartographie).toEqual({ periodicite: 'SEMESTRIELLE', etapes: [{ key: 'suivi', titre: 'Revue', description: 'Comité' }] })
    expect(auditLog).toHaveBeenCalledWith('ORGANIZATION_CONFIG_UPDATED', expect.anything())
  })
})
