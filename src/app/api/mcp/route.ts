// ─── Endpoint serveur MCP (`/api/mcp`) ───────────────────────────────────────
// Transport HTTP requête→réponse JSON (variante non-streamée, conforme MCP). Ordre
// des gardes (cf. docs/mcp-cadrage.md §4) : (1) interrupteur d'instance `mcpEnabled`
// + clé d'API valide + scope `mcp` (via `authenticateMcpRequest`) ; (2) rate limit
// `mcp:<keyId>` ; (3) dispatch JSON-RPC vers les outils, STRICTEMENT org-scopés à la
// clé ; (4) audit `MCP_TOOL_INVOKED` (+ transfert SIEM via auditLog). Aucune
// mutation directe : la phase 1 n'expose que des lectures.

import { NextRequest, NextResponse } from 'next/server'
import { authenticateMcpRequest } from '@/lib/mcp/auth.server'
import { buildMcpTools, type McpContext } from '@/lib/mcp/tools.server'
import { dispatchMcpMessage, JSONRPC_ERRORS } from '@/lib/mcp/protocol'
import { rateLimit, rateLimitHeaders, LIMIT_MCP } from '@/lib/rate-limit'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** Réponse JSON-RPC d'erreur de transport (corps illisible). */
function parseError() {
  return NextResponse.json(
    { jsonrpc: '2.0', id: null, error: { code: JSONRPC_ERRORS.PARSE, message: 'Parse error' } },
    { status: 400 },
  )
}

// GET : pas de flux initié par le serveur en phase 1 (transport requête→réponse).
export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'POST' } })
}

// POST /api/mcp — un message (ou lot) JSON-RPC MCP.
export async function POST(req: NextRequest) {
  const auth = await authenticateMcpRequest(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Rate limiting par clé d'API (indépendant de l'IP — accès machine).
  const rl = await rateLimit(`mcp:${auth.keyId}`, LIMIT_MCP.limit, LIMIT_MCP.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return parseError()
  }

  const tools = buildMcpTools()
  const ctx: McpContext = { organizationId: auth.organizationId, keyId: auth.keyId }
  const ip = getClientIp(req)

  // Journalise chaque invocation d'outil (best-effort ; alimente aussi le SIEM).
  const audit = (tool: string, okCall: boolean) =>
    auditLog('MCP_TOOL_INVOKED', {
      organizationId: auth.organizationId, ip, targetType: 'mcp-tool', targetId: tool,
      details: { keyId: auth.keyId, tool, ok: okCall },
    }).catch(() => {})

  // Lot JSON-RPC (tableau) ou message unique.
  if (Array.isArray(body)) {
    const responses: unknown[] = []
    for (const msg of body) {
      const { response, invoked } = await dispatchMcpMessage(msg, tools, ctx)
      if (invoked) await audit(invoked.tool, invoked.ok)
      if (response) responses.push(response)
    }
    if (responses.length === 0) return new NextResponse(null, { status: 202 })
    return NextResponse.json(responses)
  }

  const { response, invoked } = await dispatchMcpMessage(body, tools, ctx)
  if (invoked) await audit(invoked.tool, invoked.ok)
  // Notification (aucune réponse) → 202 Accepted, corps vide.
  if (!response) return new NextResponse(null, { status: 202 })
  return NextResponse.json(response)
}
