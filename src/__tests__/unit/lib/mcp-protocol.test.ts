// Cœur protocole MCP (JSON-RPC 2.0) — pur, sans base. Vérifie initialize, ping,
// tools/list, tools/call (succès / erreur handler / outil inconnu), notifications
// et méthodes inconnues.
import { describe, it, expect, vi } from 'vitest'
import {
  dispatchMcpMessage, toolText, JSONRPC_ERRORS, MCP_PROTOCOL_VERSIONS,
  type McpTool,
} from '@/lib/mcp/protocol'

interface Ctx { organizationId: string }
const ctx: Ctx = { organizationId: 'org1' }

const echoTool: McpTool<Ctx> = {
  name: 'echo',
  description: 'renvoie ses arguments',
  inputSchema: { type: 'object', properties: { v: { type: 'string' } } },
  handler: vi.fn(async (args, c) => toolText({ args, org: c.organizationId })),
}
const boomTool: McpTool<Ctx> = {
  name: 'boom', description: 'échoue', inputSchema: { type: 'object' },
  handler: async () => { throw new Error('secret interne fuite interdite') },
}
const tools = [echoTool, boomTool]

const call = (message: unknown) => dispatchMcpMessage(message, tools, ctx)

describe('dispatchMcpMessage — initialize', () => {
  it('renvoie la version demandée si supportée + capabilities tools + serverInfo', async () => {
    const { response } = await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: MCP_PROTOCOL_VERSIONS[1] } })
    expect(response).toMatchObject({
      jsonrpc: '2.0', id: 1,
      result: { protocolVersion: MCP_PROTOCOL_VERSIONS[1], capabilities: { tools: {} }, serverInfo: { name: 'acra' } },
    })
  })
  it('replie sur la version la plus récente si le client en demande une inconnue', async () => {
    const { response } = await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } })
    expect((response as any).result.protocolVersion).toBe(MCP_PROTOCOL_VERSIONS[0])
  })
})

describe('dispatchMcpMessage — tools/list & ping', () => {
  it('liste les outils avec nom, description et schéma', async () => {
    const { response } = await call({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    const list = (response as any).result.tools
    expect(list).toHaveLength(2)
    expect(list[0]).toEqual({ name: 'echo', description: expect.any(String), inputSchema: expect.any(Object) })
  })
  it('ping renvoie un résultat vide', async () => {
    const { response } = await call({ jsonrpc: '2.0', id: 3, method: 'ping' })
    expect(response).toEqual({ jsonrpc: '2.0', id: 3, result: {} })
  })
})

describe('dispatchMcpMessage — tools/call', () => {
  it('dispatche vers le handler, passe le contexte, et remonte l\'invocation', async () => {
    const { response, invoked } = await call({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'echo', arguments: { v: 'x' } } })
    expect(invoked).toEqual({ tool: 'echo', ok: true })
    const text = (response as any).result.content[0].text
    expect(text).toContain('"org": "org1"')
    expect(text).toContain('"v": "x"')
  })

  it('outil inconnu → erreur JSON-RPC INVALID_PARAMS (pas d\'exécution)', async () => {
    const { response, invoked } = await call({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope' } })
    expect(invoked).toBeUndefined()
    expect((response as any).error.code).toBe(JSONRPC_ERRORS.INVALID_PARAMS)
  })

  it('handler qui lève → résultat isError générique (aucune fuite) + invocation ok:false', async () => {
    const { response, invoked } = await call({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'boom' } })
    expect(invoked).toEqual({ tool: 'boom', ok: false })
    expect((response as any).result.isError).toBe(true)
    expect((response as any).result.content[0].text).not.toContain('secret')
  })

  it('arguments absents → objet vide passé au handler (pas de crash)', async () => {
    const { response } = await call({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'echo' } })
    expect((response as any).result.content[0].text).toContain('"args": {}')
  })
})

describe('dispatchMcpMessage — notifications & erreurs', () => {
  it('une notification (sans id) ne produit aucune réponse', async () => {
    const { response, invoked } = await call({ jsonrpc: '2.0', method: 'notifications/initialized' })
    expect(response).toBeNull()
    expect(invoked).toBeUndefined()
  })
  it('méthode inconnue → METHOD_NOT_FOUND', async () => {
    const { response } = await call({ jsonrpc: '2.0', id: 8, method: 'resources/list' })
    expect((response as any).error.code).toBe(JSONRPC_ERRORS.METHOD_NOT_FOUND)
  })
  it('message non conforme (jsonrpc manquant) → INVALID_REQUEST id null', async () => {
    const { response } = await call({ id: 9, method: 'ping' })
    expect(response).toMatchObject({ id: null, error: { code: JSONRPC_ERRORS.INVALID_REQUEST } })
  })
})
