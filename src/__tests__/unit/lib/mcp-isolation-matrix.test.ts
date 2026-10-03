// Matrice d'isolation MCP (cliquet) : tout outil exposé doit être déclaré ici avec sa nature et le test qui prouve son
// isolation par organisation. Un nouvel outil sans entrée fait échouer ce test : on ne livre pas d'outil sans preuve.
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { buildMcpTools } from '@/lib/mcp/tools.server'

type Kind = 'LECTURE_ORG' | 'LECTURE_METHODE' | 'PROPOSITION_ANCREE'
const MATRICE: Record<string, { kind: Kind; preuve: string }> = {
  read_referentiels: { kind: 'LECTURE_ORG', preuve: 'mcp-tools.test.ts' },
  read_taxonomie: { kind: 'LECTURE_METHODE', preuve: 'mcp-tools-context.test.ts' },
  read_sector_examples: { kind: 'LECTURE_METHODE', preuve: 'mcp-tools-context.test.ts' },
  read_risk_posture: { kind: 'LECTURE_ORG', preuve: 'mcp-tools-context.test.ts' },
  recommend_risks_scenarios: { kind: 'LECTURE_ORG', preuve: 'mcp-tools-recommend.test.ts' },
  read_notification_regimes: { kind: 'LECTURE_METHODE', preuve: 'mcp-tools-knowledge.test.ts' },
  read_incident_types: { kind: 'LECTURE_METHODE', preuve: 'mcp-tools-knowledge.test.ts' },
  read_dora_fields: { kind: 'LECTURE_METHODE', preuve: 'mcp-tools-knowledge.test.ts' },
  read_catalogue: { kind: 'LECTURE_METHODE', preuve: 'mcp-tools-knowledge.test.ts' },
  propose_risk: { kind: 'PROPOSITION_ANCREE', preuve: 'mcp-tools-propose.test.ts' },
  propose_measure: { kind: 'PROPOSITION_ANCREE', preuve: 'mcp-tools-propose.test.ts' },
  propose_plan_action: { kind: 'PROPOSITION_ANCREE', preuve: 'mcp-tools-propose.test.ts' },
  propose_conformite: { kind: 'PROPOSITION_ANCREE', preuve: 'mcp-tools-propose.test.ts' },
  propose_analysis_import: { kind: 'PROPOSITION_ANCREE', preuve: 'mcp-tools-propose.test.ts' },
  analyse_import_preview: { kind: 'LECTURE_METHODE', preuve: 'mcp-tools-propose.test.ts' },
}

describe('matrice d’isolation MCP', () => {
  it('chaque outil exposé est déclaré (et aucun outil déclaré n’a disparu), avec un fichier de preuve existant', () => {
    expect(buildMcpTools().map(t => t.name).sort()).toEqual(Object.keys(MATRICE).sort())
    for (const [name, m] of Object.entries(MATRICE)) expect(existsSync(join(process.cwd(), 'src/__tests__/unit/lib', m.preuve)), `${name} → ${m.preuve}`).toBe(true)
  })
  it('un outil de proposition exige une ancre ; une lecture d’organisation ne prend jamais d’organizationId en argument', () => {
    for (const t of buildMcpTools()) {
      const kind = MATRICE[t.name].kind
      const props = Object.keys((t.inputSchema as { properties?: Record<string, unknown> }).properties ?? {})
      expect(props, `${t.name} ne doit pas accepter organizationId`).not.toContain('organizationId')
      if (kind === 'PROPOSITION_ANCREE') expect(props.some(p => /analyseId|targetId|targetType/.test(p)), t.name).toBe(true)
    }
  })
})
