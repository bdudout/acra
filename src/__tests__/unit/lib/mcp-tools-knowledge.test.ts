// Outils MCP de CONNAISSANCE (lecture seule, livrés avec ACRA, non spécifiques à une organisation) : régimes de déclaration et
// délais, incidents types, champs DORA de l'ITS, catalogue sectoriel. Ils donnent à l'agent des faits vérifiés et sourcés plutôt que
// des souvenirs ; aucun accès aux données d'une organisation.
import { describe, it, expect } from 'vitest'
import { readNotificationRegimesTool, readIncidentTypesTool, readDoraFieldsTool, readCatalogueTool } from '@/lib/mcp/tools-knowledge.server'
import { buildMcpTools } from '@/lib/mcp/tools.server'

const ctx = { organizationId: 'orgA', keyId: 'k1' }
const run = async (t: { handler: (a: Record<string, unknown>, c: typeof ctx) => Promise<{ content: { text: string }[]; isError?: boolean }> }, a: Record<string, unknown> = {}) => JSON.parse((await t.handler(a, ctx)).content[0].text)

describe('connaissance MCP', () => {
  it('sont enregistrés', () => {
    const names = buildMcpTools().map(t => t.name)
    for (const n of ['read_notification_regimes', 'read_incident_types', 'read_dora_fields', 'read_catalogue']) expect(names).toContain(n)
  })
  it('régimes : délais exacts (DORA 4 h / 24 h / 72 h / 1 mois, RGPD 72 h), base légale, destinataire et sources ; un code', async () => {
    const all = await run(readNotificationRegimesTool, { locale: 'fr' })
    const codes = all.regimes.map((r: { code: string }) => r.code)
    for (const c of ['DORA', 'NIS2', 'RGPD_33', 'CRA_14', 'SEC_8K', 'NYDFS_500_17', 'HIPAA_BREACH']) expect(codes, c).toContain(c)
    const dora = all.regimes.find((r: { code: string }) => r.code === 'DORA')
    expect(dora.basis).toMatch(/2022\/2554/); expect(dora.deadlines).toMatch(/4 h/); expect(dora.deadlines).toMatch(/72 h/); expect(dora.sources.length).toBeGreaterThan(0)
    const rgpd = await run(readNotificationRegimesTool, { code: 'RGPD_33' })
    expect(rgpd.regimes).toHaveLength(1); expect(rgpd.regimes[0].phases[0].delai).toMatchObject({ h: 72 })
    expect(rgpd.regimes[0].note).toMatch(/pas un avis juridique|à confirmer/i)
  })
  it('incidents types : recherche tolérante, filtrée par secteur, avec régimes à examiner et éléments à compléter', async () => {
    const r = await run(readIncidentTypesTool, { query: 'hameçonnage', locale: 'fr' })
    expect(r.types[0].key).toBe('cyber.phishing'); expect(r.types[0].regimes).toBeDefined(); expect(r.types[0].aCompleter.length).toBeGreaterThan(0)
    const sante = await run(readIncidentTypesTool, { sectors: ['SANTE'], limit: 100 })
    expect(sante.types.some((t: { sector?: string }) => t.sector === 'SANTE')).toBe(true); expect(sante.types.some((t: { sector?: string }) => t.sector === 'DEFENSE')).toBe(false)
  })
  it('champs DORA : étape, obligatoire, listes de valeurs ; étape invalide → erreur', async () => {
    const r = await run(readDoraFieldsTool, { stage: 'INITIAL', mandatoryOnly: true })
    expect(r.stage).toBe('INITIAL'); expect(r.fields.length).toBeGreaterThan(10)
    expect(r.fields.every((f: { mandatory: string }) => f.mandatory === 'ALL' || f.mandatory === 'FROM_INTERMEDIATE' || f.mandatory === 'FINAL' || f.mandatory === 'COND')).toBe(true)
    expect(r.source).toMatch(/2025\/302/)
    const bad = await readDoraFieldsTool.handler({ stage: 'X' }, ctx); expect(bad.isError).toBe(true)
  })
  it('catalogue sectoriel : filtres secteur / nature / texte, bornée', async () => {
    const r = await run(readCatalogueTool, { sector: 'SANTE', kind: 'CONTROL', query: 'accès', limit: 5 })
    expect(r.items.length).toBeGreaterThan(0); expect(r.items.length).toBeLessThanOrEqual(5)
    expect(r.items.every((i: { kind: string }) => i.kind === 'CONTROL')).toBe(true)
    expect(r.version).toMatch(/^1\./)
    expect((await run(readCatalogueTool, { sector: 'INCONNU' })).items).toEqual([])
  })
})

import { readResilienceTestsTool } from '@/lib/mcp/tools-knowledge.server'
describe('read_resilience_tests (DORA art. 25-26)', () => {
  it('douze types de l’article 25 § 1, libellés dans la langue demandée ; TLPT à part avec ses règles et la répartition entité / autorité', async () => {
    const fr = await run(readResilienceTestsTool, { locale: 'fr' })
    expect(fr.art25.map((t: { code: string }) => t.code)).toHaveLength(12)
    expect(fr.art25.map((t: { code: string }) => t.code)).not.toContain('TLPT')
    expect(fr.art25.find((t: { code: string }) => t.code === 'PENETRATION').label).toBe('Tests de pénétration')
    expect((await run(readResilienceTestsTool, { locale: 'en' })).art25.find((t: { code: string }) => t.code === 'PENETRATION').label).toMatch(/penetration/i)
    expect(fr.tlpt.frequence).toMatch(/3 ans/); expect(fr.tlpt.article).toMatch(/26/); expect(fr.tlpt.entite).toBeTruthy(); expect(fr.tlpt.autorite).toBeTruthy()
    expect(fr.note).toMatch(/à confirmer/i)
  })
})

describe('ergonomie des outils de connaissance (retours du comparatif)', () => {
  it('accepte « secteur » comme alias de « sector » et signale clairement un argument inconnu au lieu de l’ignorer', async () => {
    const r = await run(readCatalogueTool, { secteur: 'ASSURANCE', kind: 'CONTROL', limit: 100 })
    expect(r.items.length).toBeGreaterThan(0); expect(r.items.some((i: { sector: string }) => i.sector === 'ASSURANCE')).toBe(true); expect(r.items.every((i: { sector: string }) => i.sector === 'ASSURANCE' || i.sector === 'TRANSVERSAL')).toBe(true)
    const bad = await readNotificationRegimesTool.handler({ secteur: 'SANTE' }, ctx)
    expect(bad.isError).toBe(true); expect(bad.content[0].text).toMatch(/argument_inconnu.*secteur.*code, locale/)
  })
  it('la recherche porte aussi sur le domaine (processus) et les références : « mutuelle » trouve les contrôles des adhérents', async () => {
    const r = await run(readCatalogueTool, { sector: 'ASSURANCE', kind: 'CONTROL', query: 'mutuelle', limit: 50 })
    const keys = r.items.map((i: { key: string }) => i.key)
    expect(keys).toContain('assurance.control.member-contributions'); expect(keys).toContain('assurance.control.statutes-assembly')
    expect((await run(readCatalogueTool, { sector: 'ASSURANCE', query: 'Code de la mutualité', limit: 100 })).items.length).toBeGreaterThan(0)
  })
})
