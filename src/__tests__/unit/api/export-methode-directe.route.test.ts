// @vitest-environment node
/**
 * P4 — GET /api/export/[id] pour une analyse à saisie directe : rapport propre à
 * la méthode (Excel ici), export journalisé, plans d'action cloisonnés (org + ref),
 * accès refusé hors périmètre.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => ({ allowed: true, remaining: 10, resetAt: 0 })), rateLimitHeaders: vi.fn(() => ({})), LIMIT_EXPORT: { limit: 20, windowMs: 1 } }))
vi.mock('@/lib/org-context.server', () => ({ analyseAccessWhere: vi.fn(async () => ({})) }))
const analyseFindFirst = vi.fn()
const planFindMany = vi.fn(async (..._a: unknown[]) => [{ titre: 'MFA', statut: 'A_FAIRE', priorite: 'MAJEUR', echeance: null, porteur: 'RSSI', liens: [{ targetId: 'r1' }] }])
vi.mock('@/lib/prisma', () => ({ prisma: { analyse: { findFirst: (...a: unknown[]) => analyseFindFirst(...a) }, planAction: { findMany: (...a: unknown[]) => planFindMany(...a) } } }))
vi.mock('@/lib/configuration-server', () => ({ getEffectiveScaleConfig: vi.fn(async () => ({ nbNiveaux: 4, echelleGravite: [], echelleVraisemblance: [], seuilsMatrice: [] })) }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ appetitRisque: { seuilGlobal: 9, parCategorie: {} } })) }))
const auditLog = vi.fn()
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: vi.fn(() => '') }))

import { GET } from '@/app/api/export/[id]/route'

const ANALYSE = {
  id: 'an1', nom: 'SI Santé', methode: 'ISO_27005', organizationId: 'orgA', userId: 'u1', deletedAt: null, accesUtilisateurs: [],
  cadrage: { perimetre: 'DPI', objectifsEtude: null }, mesures: [],
  risques: [{ id: 'r1', nom: 'Rançongiciel', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE', proprietaire: 'DSI', vulnerabilites: [] }],
}
const req = (q: string) => ({ url: `http://x/api/export/an1?${q}` }) as never
const P = { params: Promise.resolve({ id: 'an1' }) }

beforeEach(() => { vi.clearAllMocks(); analyseFindFirst.mockResolvedValue({ ...ANALYSE }) })

describe('GET /api/export/[id] — méthodes directes', () => {
  it('xlsx : rapport de la méthode (registre, décision selon l’appétit), export journalisé', async () => {
    const res = await GET(req('format=xlsx&lang=fr'), P)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('acra-iso-27005-SI-Sant-.xlsx')
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await res.arrayBuffer()) as unknown as ExcelJS.Buffer)
    const row = wb.getWorksheet('Registre des risques')!.getRow(2).values as unknown[]
    expect(row).toEqual(expect.arrayContaining(['R1', 'Rançongiciel', 'DSI', 'À traiter', 'Appétit ≤ 9']))
    expect(wb.getWorksheet('Plans d’action')!.getRow(2).values).toEqual(expect.arrayContaining(['R1', 'MFA']))
    expect(auditLog).toHaveBeenCalledWith('EXPORT', expect.objectContaining({ targetId: 'an1', details: { format: 'xlsx', methode: 'ISO_27005' } }))
  })

  it('plans d’action cloisonnés : organisation de l’analyse ET liens RISQUE_ANALYSE de cette analyse', async () => {
    await GET(req('format=xlsx'), P)
    expect((planFindMany.mock.calls[0][0] as { where: unknown }).where).toEqual({ organizationId: 'orgA', liens: { some: { type: 'RISQUE_ANALYSE', ref: 'an1' } } })
  })

  it('analyse hors périmètre : 404, rien d’exporté ni de journalisé', async () => {
    analyseFindFirst.mockResolvedValue(null)
    expect((await GET(req('format=xlsx'), P)).status).toBe(404)
    expect(auditLog).not.toHaveBeenCalled()
  })
})
