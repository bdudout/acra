// @vitest-environment node
// GET /api/ropa/export : registre des traitements de l'organisation active en Excel (RGPD art. 30 §4) ; DPO / ADMIN ;
// export journalisé.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), findMany: vi.fn(), org: vi.fn(), audit: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '' }))
vi.mock('@/lib/i18n', async () => ({ ...(await vi.importActual<object>('@/lib/i18n')), getServerLocale: async () => 'fr' }))
vi.mock('@/lib/prisma', () => ({ prisma: { traitement: { findMany: m.findMany }, organization: { findUnique: m.org } } }))
import { GET as GET_ } from '@/app/api/ropa/export/route'
const GET = () => GET_(new NextRequest('http://x/api/ropa/export'))

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'DPO' })
  m.org.mockResolvedValue({ nom: 'Banque Exemple' })
  m.findMany.mockResolvedValue([{ id: 't1', nom: 'Paie', finalite: 'Paie', baseLegale: 'obligation_legale', categoriesPersonnes: ['Salariés'], categoriesDonnees: ['Identité'], destinataires: ['DRH'], transfertHorsUE: false, dureeConservation: '5 ans', mesuresSecurite: ['Chiffrement'] }])
})

describe('GET /api/ropa/export', () => {
  it('DPO : classeur Excel du registre de l’organisation active, export journalisé', async () => {
    const r = await GET()
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('spreadsheetml')
    expect(r.headers.get('content-disposition')).toContain('registre-traitements')
    expect(m.findMany.mock.calls[0][0].where).toEqual({ organizationId: 'o1' })
    expect(m.audit).toHaveBeenCalledWith('EXPORT', expect.objectContaining({ organizationId: 'o1', targetType: 'ropa', details: expect.objectContaining({ format: 'xlsx', traitements: 1 }) }))
  })
  it('autre rôle → 403 ; sans session → 401 ; sans organisation active → 400', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await GET()).status).toBe(403)
    m.scope.mockResolvedValue({ activeOrgId: null, role: 'DPO' })
    expect((await GET()).status).toBe(400)
    m.session.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    expect(m.findMany).not.toHaveBeenCalled()
  })
})
