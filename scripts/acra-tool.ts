// Appelle un outil MCP d'ACRA en ligne de commande (lecture seule, outils de connaissance ou de contexte) : sert à la comparaison
// « Claude avec ACRA » / « Claude seul » (docs/specs/benchmark-acra-vs-claude.md) sans serveur ni base.
// Usage : npx tsx --tsconfig tsconfig.json scripts/acra-tool.ts <outil> '<json des arguments>'   (sans argument : liste les outils)
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5433/unused'

async function main() {
  const { buildMcpTools } = await import('../src/lib/mcp/tools.server')
  const tools = buildMcpTools()
  const [name, raw] = process.argv.slice(2)
  const SANS_BASE = new Set(['read_notification_regimes', 'read_incident_types', 'read_dora_fields', 'read_catalogue', 'read_resilience_tests', 'read_taxonomie', 'read_sector_examples', 'analyse_import_preview', 'recommend_control_plan'])
  if (!name) { for (const t of tools.filter(x => SANS_BASE.has(x.name))) console.log(`${t.name} — ${t.description}\n  schéma: ${JSON.stringify(t.inputSchema)}\n`); return }
  const tool = tools.find(t => t.name === name && SANS_BASE.has(t.name))
  if (!tool) { console.error(`Outil inconnu ou nécessitant une organisation : ${name}`); process.exit(2) }
  const args = raw ? JSON.parse(raw) : {}
  const res = await tool.handler(args, { organizationId: 'bench', keyId: 'bench' })
  console.log(res.content.map(c => c.text).join('\n'))
  if (res.isError) process.exit(1)
}
main().then(() => process.exit(0))
