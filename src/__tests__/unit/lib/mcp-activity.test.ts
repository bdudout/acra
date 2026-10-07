// Synthèse de l'activité MCP d'une organisation (pure) : clés portant le scope mcp, appels journalisés
// (MCP_TOOL_INVOKED) sur la fenêtre, propositions par statut, et état de chaque clé.
import { describe, it, expect } from 'vitest'
import { parseAppelMcp, syntheseActiviteMcp } from '@/lib/mcp/activity'

const now = new Date('2026-10-07T12:00:00Z')
const cle = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: `Clé ${id}`, prefix: `p${id}`, scopes: ['read', 'mcp'], createdAt: new Date('2026-09-01'), lastUsedAt: null, expiresAt: null, revokedAt: null, ...extra })

describe('parseAppelMcp', () => {
  it('lit le détail JSON du journal ; ignore un détail illisible', () => {
    expect(parseAppelMcp('{"keyId":"k1","tool":"read_projet","ok":false}', now)).toEqual({ keyId: 'k1', tool: 'read_projet', ok: false, createdAt: now })
    expect(parseAppelMcp('pas du json', now)).toBeNull()
    expect(parseAppelMcp(null, now)).toBeNull()
  })
})

describe('syntheseActiviteMcp', () => {
  const s = syntheseActiviteMcp({
    maintenant: now, jours: 30,
    cles: [cle('k1', { lastUsedAt: new Date('2026-10-07T10:00:00Z') }), cle('k2', { revokedAt: new Date('2026-10-01') }), cle('k3', { expiresAt: new Date('2026-10-01') }), cle('k4', { scopes: ['read'] })],
    appels: [
      { keyId: 'k1', tool: 'read_projet', ok: true, createdAt: new Date('2026-10-07T09:00:00Z') },
      { keyId: 'k1', tool: 'read_projet', ok: true, createdAt: new Date('2026-10-06T09:00:00Z') },
      { keyId: 'k1', tool: 'propose_risk', ok: false, createdAt: new Date('2026-10-06T09:00:00Z') },
      { keyId: 'k2', tool: 'read_analyses', ok: true, createdAt: new Date('2026-08-01T09:00:00Z') }, // hors fenêtre
    ],
    propositions: [{ apiKeyId: 'k1', statut: 'EN_ATTENTE' }, { apiKeyId: 'k1', statut: 'ACCEPTEE' }, { apiKeyId: 'k2', statut: 'REJETEE' }],
  })
  it('ne retient que les clés au scope mcp, avec leur état (active, révoquée, expirée)', () => {
    expect(s.cles.map(c => [c.id, c.etat])).toEqual([['k1', 'ACTIVE'], ['k2', 'REVOQUEE'], ['k3', 'EXPIREE']])
    expect(s.cles[0].masque).toContain('pk1')
  })
  it('compte appels, erreurs et outils par clé sur la fenêtre ; propositions par statut', () => {
    expect(s.cles[0]).toMatchObject({ appels: 3, erreurs: 1, outils: [{ outil: 'read_projet', n: 2 }, { outil: 'propose_risk', n: 1 }], propositions: { EN_ATTENTE: 1, ACCEPTEE: 1, REJETEE: 0 } })
    expect(s.cles[1]).toMatchObject({ appels: 0, propositions: { REJETEE: 1 } })
  })
  it('totaux et série quotidienne (une entrée par jour de la fenêtre)', () => {
    expect(s.totaux).toEqual({ clesActives: 1, clesInactives: 2, appels: 3, erreurs: 1, enAttente: 1, acceptees: 1, rejetees: 1 })
    expect(s.parJour).toHaveLength(30)
    expect(s.parJour.at(-1)).toEqual({ jour: '2026-10-07', n: 1 })
    expect(s.parJour.at(-2)).toEqual({ jour: '2026-10-06', n: 2 })
  })
})
