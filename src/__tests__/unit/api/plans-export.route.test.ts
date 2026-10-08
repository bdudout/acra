// Exports Excel du programme d'audit et de contrôle (lot P6) : fichier xlsx, export journalisé, 404 hors organisation.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), config: vi.fn(), plan: vi.fn(), audit: vi.fn(), vue: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '' }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: async () => ({ allowed: true }), rateLimitHeaders: () => ({}), LIMIT_EXPORT: { limit: 9, windowMs: 1 } }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  planProgramme: { findFirst: m.plan },
  planAnnee: { findMany: async () => [{ annee: 2027, statut: 'BROUILLON', valideLe: null, revision: 0, motifRevision: null, commentaire: null }] },
  planLigne: { findMany: async () => [{ id: 'l1', annee: 2027, intitule: 'Accès', prisme: 'RISQUE', cibles: { risques: ['r1'] }, echantillon: null, debut: new Date('2027-03-01'), fin: null, charge: null, priorite: 2, responsable: null, statutManuel: null, realisations: [] }] },
  organization: { findUnique: async () => ({ nom: 'Mutuelle', path: '/o1/' }), findMany: async () => [] },
  tierOrganization: { findMany: async () => [] }, riskItem: { findMany: async () => [{ id: 'r1', intitule: 'Fraude' }] }, processus: { findMany: async () => [] },
  auditMission: { findMany: async () => [] }, controle: { findMany: async () => [] }, campagneControle: { findMany: async () => [] },
  entite: { findMany: async () => [] }, entiteEvenement: { findMany: async () => [] },
} }))
import { GET as EXPORT_PLAN } from '@/app/api/plans/[id]/export/route'

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
  m.config.mockResolvedValue({ auditInterneActive: true, controlePermanentActive: true, planificationConfig: {} })
  m.plan.mockResolvedValue({ id: 'p1', organizationId: 'o1', type: 'AUDIT', nom: 'Audit SI', equipe: null, prismePrincipal: 'RISQUE', mode: 'FIGE', anneeDebut: 2027, anneeFin: 2027 })
})

describe('export Excel d’un plan', () => {
  it('fichier xlsx nommé d’après le plan, export journalisé ; plan hors organisation → 404', async () => {
    const r = await EXPORT_PLAN(new NextRequest('http://x/api/plans/p1/export?lang=fr'), { params: Promise.resolve({ id: 'p1' }) })
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toContain('spreadsheetml')
    expect(r.headers.get('Content-Disposition')).toContain('plan-audit-si.xlsx')
    expect(m.audit).toHaveBeenCalledWith('EXPORT', expect.objectContaining({ targetType: 'plan', targetId: 'p1' }))
    m.plan.mockResolvedValue(null)
    expect((await EXPORT_PLAN(new NextRequest('http://x'), { params: Promise.resolve({ id: 'p1' }) })).status).toBe(404)
  })
})
