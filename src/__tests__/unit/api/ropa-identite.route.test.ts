// @vitest-environment node
// /api/ropa/identite : identité du responsable du traitement (RGPD art. 30 §1 a). DPO repris automatiquement s'il est
// désigné dans ACRA ; DPO / ADMIN seulement ; enregistrement journalisé.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), audit: vi.fn(), org: vi.fn(), find: vi.fn(), upsert: vi.fn(), membres: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '' }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  organization: { findUnique: m.org },
  ropaIdentite: { findUnique: m.find, upsert: m.upsert },
  orgMembership: { findMany: m.membres },
} }))
import { GET, PUT } from '@/app/api/ropa/identite/route'

const put = (body: object) => PUT(new NextRequest('http://x/api/ropa/identite', { method: 'PUT', body: JSON.stringify(body) }))

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'f1', role: 'DPO' })
  m.org.mockResolvedValue({ id: 'f1', path: '/g/f1/' })
  m.find.mockResolvedValue({ responsableNom: 'Banque Exemple SA', responsableAdresse: '', responsableContact: 'contact@banque.fr', representantNom: '', representantContact: '', dpoNom: 'DPO externe', dpoContact: 'dpo@cabinet.fr' })
  m.membres.mockResolvedValue([{ organizationId: 'f1', role: 'DPO', scope: 'NODE', user: { name: 'Alice Martin', email: 'alice@x.fr', isActive: true } }])
  m.upsert.mockImplementation(async ({ create }: { create: object }) => create)
})

describe('/api/ropa/identite', () => {
  it('GET : saisie, DPO désigné repris automatiquement, rattachements bornés à l’organisation et à ses ancêtres', async () => {
    const j = await (await GET()).json()
    expect(m.membres.mock.calls[0][0].where).toEqual({ role: 'DPO', organizationId: { in: ['g', 'f1'] } })
    expect(j.effective.dpo).toEqual({ source: 'DESIGNE', nom: 'Alice Martin', contact: 'alice@x.fr' })
    expect(j.saisie.dpoNom).toBe('DPO externe')
    expect(j.effective.manquants).toEqual([])
  })
  it('PUT : saisie nettoyée et enregistrée pour l’organisation active, journalisée', async () => {
    const r = await put({ responsableNom: '  Banque  ', responsableContact: 'c@b.fr', organizationId: 'autre' })
    expect(r.status).toBe(200)
    expect(m.upsert.mock.calls[0][0]).toMatchObject({ where: { organizationId: 'f1' }, create: { organizationId: 'f1', responsableNom: 'Banque', responsableContact: 'c@b.fr' } })
    expect(m.audit).toHaveBeenCalledWith('ORGANIZATION_CONFIG_UPDATED', expect.objectContaining({ organizationId: 'f1', details: expect.objectContaining({ scope: 'ropa-identite' }) }))
  })
  it('autre rôle → 403 (lecture et écriture)', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'f1', role: 'RSSI' })
    expect((await GET()).status).toBe(403)
    expect((await put({ responsableNom: 'X' })).status).toBe(403)
    expect(m.upsert).not.toHaveBeenCalled()
  })
})
