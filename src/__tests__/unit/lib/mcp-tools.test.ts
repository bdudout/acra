// Outil MCP `read_referentiels` — lecture STRICTEMENT org-scopée. On mocke prisma
// pour vérifier le filtre `organizationId`, la branche liste vs. code, la borne, et
// la non-divulgation (référentiel absent → found:false, pas d'erreur).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const findMany = vi.fn()
const findFirst = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: { referentiel: { findMany: (...a: unknown[]) => findMany(...a), findFirst: (...a: unknown[]) => findFirst(...a) } },
}))

import { readReferentielsTool } from '@/lib/mcp/tools.server'

const ctx = { organizationId: 'orgA' }
const parse = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text)

describe('read_referentiels — liste', () => {
  beforeEach(() => { findMany.mockReset(); findFirst.mockReset() })

  it('filtre sur organizationId, borne take, et résume le nombre d\'exigences', async () => {
    findMany.mockResolvedValue([
      { code: 'PSSI-2026', nom: 'PSSI', type: 'PSSI', domaine: 'SECURITE_SI', version: '1', actif: true, exigences: [{ ref: 'A' }, { ref: 'B' }], updatedAt: new Date() },
    ])
    const res = await readReferentielsTool.handler({}, ctx)
    expect(findMany).toHaveBeenCalledTimes(1)
    const where = findMany.mock.calls[0][0].where
    expect(where).toEqual({ organizationId: 'orgA' })
    const out = parse(res)
    expect(out.count).toBe(1)
    expect(out.referentiels[0]).toMatchObject({ code: 'PSSI-2026', nbExigences: 2 })
    // Les exigences complètes ne sont PAS renvoyées dans la vue liste.
    expect(out.referentiels[0].exigences).toBeUndefined()
  })

  it('limite invalide → défaut ; limite hors borne → plafonnée à 200', async () => {
    findMany.mockResolvedValue([])
    await readReferentielsTool.handler({ limit: 9999 }, ctx)
    expect(findMany.mock.calls[0][0].take).toBe(200)
    await readReferentielsTool.handler({ limit: 'abc' }, ctx)
    expect(findMany.mock.calls[1][0].take).toBe(50)
  })
})

describe('read_referentiels — code précis', () => {
  beforeEach(() => { findMany.mockReset(); findFirst.mockReset() })

  it('renvoie les exigences détaillées, org-scopé', async () => {
    findFirst.mockResolvedValue({ id: 'r1', code: 'PSSI-2026', nom: 'PSSI', type: 'PSSI', domaine: 'SECURITE_SI', version: '1', description: null, actif: true, exigences: [{ ref: 'A' }], updatedAt: new Date() })
    const res = await readReferentielsTool.handler({ code: 'PSSI-2026' }, ctx)
    expect(findFirst.mock.calls[0][0].where).toEqual({ organizationId: 'orgA', code: 'PSSI-2026' })
    const out = parse(res)
    expect(out.found).toBe(true)
    expect(out.referentiel.nbExigences).toBe(1)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('code absent (autre org ou inexistant) → found:false, sans erreur ni divulgation', async () => {
    findFirst.mockResolvedValue(null)
    const res = await readReferentielsTool.handler({ code: 'SECRET-AUTRE-ORG' }, ctx)
    expect(res.isError).toBeUndefined()
    expect(parse(res)).toEqual({ referentiel: null, found: false })
  })
})
