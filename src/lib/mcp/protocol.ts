// ─── Serveur MCP — cœur protocole (JSON-RPC 2.0, PUR) ────────────────────────
// Implémente le sous-ensemble MCP nécessaire au « socle » (cf. docs/mcp-cadrage.md
// §10.1) : initialize, ping, tools/list, tools/call, notifications. AUCUN accès
// DB ni réseau ici — les outils (handlers) sont INJECTÉS et génériques sur un
// contexte `Ctx` (résolu côté serveur : organisation de la clé d'API). Ce module
// est donc pur et testable sans base. La garde d'activation (`mcpEnabled`),
// l'authentification (clé + scope `mcp`), le rate limiting et l'audit vivent dans
// la route (`app/api/mcp/route.ts`) et `mcp/*.server.ts`.
//
// Transport : HTTP « requête → réponse JSON » (variante non-streamée, conforme au
// standard MCP qui autorise une réponse `application/json` à un POST). Pas de flux
// initié par le serveur en phase 1.

/** Versions de protocole MCP supportées (la plus récente en tête). */
export const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const
/** Version annoncée par défaut si le client n'en propose pas de connue. */
export const MCP_DEFAULT_PROTOCOL_VERSION = MCP_PROTOCOL_VERSIONS[0]

/** Identité du serveur MCP renvoyée à `initialize`. */
export interface McpServerInfo { name: string; version: string }
const DEFAULT_SERVER_INFO: McpServerInfo = { name: 'acra', version: '1' }

/** Résultat normalisé d'un outil MCP (contenu textuel ; `isError` pour un échec métier). */
export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

/** Fabrique un résultat d'outil texte (sérialise un objet en JSON lisible). */
export function toolText(payload: unknown): McpToolResult {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
  return { content: [{ type: 'text', text }] }
}

/**
 * Définition d'un outil MCP. `inputSchema` est un JSON Schema (objet) décrivant les
 * arguments. `handler` reçoit les arguments (déjà garantis « objet ») et le
 * contexte serveur ; il ne doit jamais laisser fuir une ressource hors périmètre.
 */
export interface McpTool<Ctx> {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, unknown>, ctx: Ctx) => Promise<McpToolResult>
}

// ── JSON-RPC 2.0 ─────────────────────────────────────────────────────────────
/** Codes d'erreur JSON-RPC 2.0 standard utilisés par le serveur. */
export const JSONRPC_ERRORS = {
  PARSE: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602, INTERNAL: -32603,
} as const

type JsonRpcId = string | number | null
interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: JsonRpcId
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

function ok(id: JsonRpcId, result: unknown): JsonRpcResponse { return { jsonrpc: '2.0', id, result } }
function err(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: data === undefined ? { code, message } : { code, message, data } }
}

/** Trace d'invocation d'outil, remontée à la route pour l'audit (`MCP_TOOL_INVOKED`). */
export interface McpInvocation { tool: string; ok: boolean }

/** Options de dispatch (identité serveur, versions supportées). */
export interface DispatchOptions { serverInfo?: McpServerInfo; protocolVersions?: readonly string[] }

/** Réponse de dispatch : `response` nul pour une notification (aucune réponse HTTP). */
export interface DispatchResult { response: JsonRpcResponse | null; invoked?: McpInvocation }

/** Vrai si `v` est un objet simple (ni null, ni tableau). */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Traite UN message JSON-RPC MCP et renvoie la réponse (ou `null` pour une
 * notification). Pur : toute la logique métier passe par `tools` (handlers
 * injectés) et `ctx`. Ne lève jamais — les erreurs deviennent des réponses
 * JSON-RPC ou des résultats d'outil `isError`.
 */
export async function dispatchMcpMessage<Ctx>(
  message: unknown,
  tools: McpTool<Ctx>[],
  ctx: Ctx,
  opts: DispatchOptions = {},
): Promise<DispatchResult> {
  const serverInfo = opts.serverInfo ?? DEFAULT_SERVER_INFO
  const versions = opts.protocolVersions ?? MCP_PROTOCOL_VERSIONS

  if (!isPlainObject(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return { response: err(null, JSONRPC_ERRORS.INVALID_REQUEST, 'Invalid Request') }
  }
  const method = message.method
  const hasId = 'id' in message && message.id !== undefined
  const id = (hasId ? message.id : null) as JsonRpcId
  const params = isPlainObject(message.params) ? message.params : {}

  // Notifications (pas d'`id`, ex. notifications/initialized) : aucune réponse.
  if (!hasId) return { response: null }

  switch (method) {
    case 'initialize': {
      const wanted = typeof params.protocolVersion === 'string' ? params.protocolVersion : ''
      const protocolVersion = versions.includes(wanted) ? wanted : versions[0]
      return {
        response: ok(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo,
        }),
      }
    }
    case 'ping':
      return { response: ok(id, {}) }

    case 'tools/list':
      return {
        response: ok(id, {
          tools: tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
        }),
      }

    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : ''
      const tool = tools.find(t => t.name === name)
      if (!tool) return { response: err(id, JSONRPC_ERRORS.INVALID_PARAMS, `Unknown tool: ${name || '(none)'}`) }
      const args = isPlainObject(params.arguments) ? params.arguments : {}
      try {
        const result = await tool.handler(args, ctx)
        return { response: ok(id, result), invoked: { tool: name, ok: !result.isError } }
      } catch {
        // Erreur inattendue du handler : jamais de fuite de détail (message générique).
        const result: McpToolResult = { content: [{ type: 'text', text: 'tool_execution_error' }], isError: true }
        return { response: ok(id, result), invoked: { tool: name, ok: false } }
      }
    }

    default:
      return { response: err(id, JSONRPC_ERRORS.METHOD_NOT_FOUND, `Method not found: ${method}`) }
  }
}
