// #185 — bouton « Mettre à jour » d'une instance auto-hébergée : l'application
// dépose une DEMANDE (canal uniquement), un agent hôte l'exécute. Logique pure.
import { describe, expect, it } from 'vitest'
import { buildUpdateRequest, agentAlive, parseUpdateStatus, AGENT_MAX_AGE_MS } from '@/lib/update-request'

const now = new Date('2026-09-29T10:00:00Z')

describe('buildUpdateRequest', () => {
  it('ne contient que le canal, l’auteur et la date', () => {
    expect(buildUpdateRequest({ channel: 'stable', userId: 'u1', now, id: 'r1' }))
      .toEqual({ id: 'r1', channel: 'stable', requestedBy: 'u1', requestedAt: '2026-09-29T10:00:00.000Z' })
  })
  it('refuse tout canal inconnu', () => {
    expect(() => buildUpdateRequest({ channel: 'main && curl evil' as never, userId: 'u1', now, id: 'r1' })).toThrow()
  })
})

describe('agentAlive', () => {
  it('pulsation récente → agent actif ; absente, invalide ou trop ancienne → inactif', () => {
    expect(agentAlive({ at: '2026-09-29T09:58:00Z' }, now)).toBe(true)
    expect(agentAlive({ at: new Date(now.getTime() - AGENT_MAX_AGE_MS - 1000).toISOString() }, now)).toBe(false)
    expect(agentAlive(null, now)).toBe(false)
    expect(agentAlive({ at: 'n’importe quoi' }, now)).toBe(false)
  })
})

describe('parseUpdateStatus', () => {
  it('ne garde que des champs connus, bornés', () => {
    expect(parseUpdateStatus({ state: 'SUCCESS', channel: 'beta', version: '1.0.4-beta.1', message: 'x'.repeat(900), at: '2026-09-29T10:01:00Z', extra: 'ignoré' }))
      .toEqual({ state: 'SUCCESS', channel: 'beta', version: '1.0.4-beta.1', message: 'x'.repeat(500), at: '2026-09-29T10:01:00Z' })
  })
  it('état inconnu → null', () => {
    expect(parseUpdateStatus({ state: 'HACK' })).toBeNull()
    expect(parseUpdateStatus('texte')).toBeNull()
  })
})
