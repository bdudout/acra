// recommend_risks_scenarios : recommandations CALCULÉES par ACRA (catalogue sectoriel + exemples), sans LLM,
// lecture seule, bornées à l'organisation de la clé ; ce qui est déjà au registre / dans l'analyse est écarté.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const riskItemFindMany = vi.fn()
const analyseFindFirst = vi.fn()
const risqueFindMany = vi.fn()
const sectors = vi.fn()
const anchor = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: {
  riskItem: { findMany: (...a: unknown[]) => riskItemFindMany(...a) },
  analyse: { findFirst: (...a: unknown[]) => analyseFindFirst(...a) },
  risque: { findMany: (...a: unknown[]) => risqueFindMany(...a) },
} }))
vi.mock('@/lib/sector-context.server', () => ({ orgSectors: (...a: unknown[]) => sectors(...a) }))
vi.mock('@/lib/mcp/anchors.server', () => ({ anchorExistsInOrg: (...a: unknown[]) => anchor(...a) }))

import { recommendRisksScenariosTool } from '@/lib/mcp/tools-recommend.server'
import { buildMcpTools } from '@/lib/mcp/tools.server'

const ctx = { organizationId: 'orgA', keyId: 'k1' }
const parse = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text)

beforeEach(() => {
  riskItemFindMany.mockReset().mockResolvedValue([])
  analyseFindFirst.mockReset(); risqueFindMany.mockReset().mockResolvedValue([])
  sectors.mockReset().mockResolvedValue({ own: ['SANTE'], effective: ['SANTE'], inherited: false })
  anchor.mockReset().mockResolvedValue(true)
})

describe('recommend_risks_scenarios', () => {
  it('est enregistré et ne fait que LIRE : aucune proposition créée, pas de LLM', () => {
    expect(buildMcpTools().map(t => t.name)).toContain('recommend_risks_scenarios')
    expect(recommendRisksScenariosTool.description).toMatch(/aucun LLM|sans LLM/i)
  })
  it('recommande les risques du catalogue des secteurs de l’organisation, hors ceux déjà au registre', async () => {
    riskItemFindMany.mockResolvedValue([{ catalogueKey: 'sante.risk.patient-data' }])
    const out = parse(await recommendRisksScenariosTool.handler({ limit: 50 }, ctx))
    expect(sectors).toHaveBeenCalledWith('orgA')
    expect(riskItemFindMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'orgA' })
    const keys = out.catalogueRisks.map((r: { key: string }) => r.key)
    expect(keys).toContain('sante.risk.device'); expect(keys).not.toContain('sante.risk.patient-data')
    expect(keys.some((k: string) => k.startsWith('defense.'))).toBe(false)         // autre secteur : écarté
    expect(keys.some((k: string) => k.startsWith('core.'))).toBe(true)            // socle transverse inclus
    expect(out.catalogueRisks[0]).toHaveProperty('title'); expect(out.analysisScenarios).toEqual([])
    expect(out.note).toMatch(/à qualifier/i)
  })
  it('avec une analyse de l’organisation : scénarios sectoriels, hors risques déjà saisis ; analyse d’une autre organisation → introuvable', async () => {
    analyseFindFirst.mockResolvedValue({ secteur: 'Santé / Médico-social', sousSecteur: 'sante-amo' })
    risqueFindMany.mockResolvedValue([])
    const ok = parse(await recommendRisksScenariosTool.handler({ analyseId: 'a1', kinds: ['SCENARIO'] }, ctx))
    expect(anchor).toHaveBeenCalledWith('ANALYSE', 'a1', 'orgA')
    expect(analyseFindFirst.mock.calls[0][0].where).toMatchObject({ id: 'a1', organizationId: 'orgA' })
    expect(ok.analysisScenarios.length).toBeGreaterThan(0)
    expect(JSON.stringify(ok.analysisScenarios)).toMatch(/fraude|liquidation|prestations/i)   // sous-secteur assurance maladie
    expect(ok.catalogueRisks).toEqual([])
    anchor.mockResolvedValue(false)
    const ko = await recommendRisksScenariosTool.handler({ analyseId: 'autre' }, ctx)
    expect(ko.isError).toBe(true); expect(ko.content[0].text).toBe('analyse_introuvable')
  })
  it('limite bornée (1..50)', async () => {
    const out = parse(await recommendRisksScenariosTool.handler({ limit: 9999 }, ctx))
    expect(out.catalogueRisks.length).toBeLessThanOrEqual(50)
    expect(parse(await recommendRisksScenariosTool.handler({ limit: 0 }, ctx)).catalogueRisks.length).toBe(1)
  })
})

describe('recommend_control_plan', () => {
  it('est enregistré, calculé par ACRA (aucun LLM) et sans accès base', async () => {
    const { recommendControlPlanTool } = await import('@/lib/mcp/tools-recommend.server')
    expect(buildMcpTools().map(t => t.name)).toContain('recommend_control_plan')
    expect(recommendControlPlanTool.description).toMatch(/aucun LLM|sans LLM/i)
    const out = parse(await recommendControlPlanTool.handler({ profile: 'MUTUELLE_SANTE', count: 12 }, ctx))
    expect(out.controls).toHaveLength(12)
    expect(new Set(out.controls.map((c: { domain: string }) => c.domain)).size).toBe(12)
    expect(riskItemFindMany).not.toHaveBeenCalled()
  })
  it('profil inconnu : erreur explicite avec les profils disponibles', async () => {
    const { recommendControlPlanTool } = await import('@/lib/mcp/tools-recommend.server')
    const r = await recommendControlPlanTool.handler({ profile: 'XYZ' }, ctx)
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toContain('MUTUELLE_SANTE')
  })
})
