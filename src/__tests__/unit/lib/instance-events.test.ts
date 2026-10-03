// Lot 4 — lecture de .acra-update/events.log (écrit par update.sh / acra-snapshot.sh) : événements du cycle de vie de l'instance.
import { describe, it, expect } from 'vitest'
import { parseInstanceEvents, INSTANCE_EVENTS_MAX_BYTES } from '@/lib/instance-events'

describe('parseInstanceEvents', () => {
  const text = [
    'RESTORED 20261003T101500Z-pre-update-1.0.4 2026-10-03T10:30:00Z',
    'UPDATED 1.0.4 1.0.5 2026-10-03T10:40:00Z',
    'ROLLED_BACK 1.0.5 1.0.4 migrate_failed 2026-10-03T10:50:00Z',
  ].join('\n')
  it('reconnaît les trois types d’événements, avec une clé unique par ligne', () => {
    const ev = parseInstanceEvents(text)
    expect(ev.map(e => e.kind)).toEqual(['RESTORED', 'UPDATED', 'ROLLED_BACK'])
    expect(ev[0]).toMatchObject({ snapshotId: '20261003T101500Z-pre-update-1.0.4', at: '2026-10-03T10:30:00Z' })
    expect(ev[1]).toMatchObject({ from: '1.0.4', to: '1.0.5' })
    expect(ev[2]).toMatchObject({ from: '1.0.5', to: '1.0.4', code: 'migrate_failed' })
    expect(new Set(ev.map(e => e.key)).size).toBe(3)
  })
  it('ignore les lignes invalides (identifiant, date, type, injection)', () => {
    expect(parseInstanceEvents(['RESTORED ../x 2026-10-03T10:30:00Z', 'UPDATED 1.0.4 1.0.5 pas-une-date', 'HACK a b', 'UPDATED 1.0.4 1.0.5 2026-10-03T10:40:00Z; rm -rf /', '', '   '].join('\n'))).toEqual([])
  })
  it('borne la lecture aux derniers 64 Ko et au nombre d’événements', () => {
    const many = Array.from({ length: 5000 }, (_, i) => `UPDATED 1.0.${i} 1.0.${i + 1} 2026-10-03T10:40:00Z`).join('\n')
    expect(many.length).toBeGreaterThan(INSTANCE_EVENTS_MAX_BYTES)
    expect(parseInstanceEvents(many).length).toBeLessThanOrEqual(500)
  })
  it('deux lignes identiques ont la même clé (anti-doublon)', () => {
    const [a, b] = parseInstanceEvents('UPDATED 1.0.4 1.0.5 2026-10-03T10:40:00Z\nUPDATED 1.0.4 1.0.5 2026-10-03T10:40:00Z')
    expect(a.key).toBe(b.key)
  })
})
