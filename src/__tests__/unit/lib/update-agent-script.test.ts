// Lot 3 — scripts/update-agent.sh : demandes `rollback` (identifiant validé contre SON index) et reprise à chaque passage.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { writeFileSync, mkdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { makeInstance, type Instance } from '../../helpers/update-fixture'

vi.setConfig({ testTimeout: 120_000 })
let inst: Instance
afterEach(() => inst?.cleanup())
const ID = '20261003T101500Z-pre-update-1.0.4'
function setup() {
  inst = makeInstance({ scripts: ['update.sh', 'update-lib.sh', 'update-steps.sh', 'acra-snapshot.sh', 'update-agent.sh'] })
  mkdirSync(path.join(inst.work, '.acra-update/inbox'), { recursive: true })
  writeFileSync(path.join(inst.work, '.acra-update/agent.env'), 'ACRA_COMPOSE_FILES=\n')
  // faux update.sh : consigne ses arguments (le vrai est testé ailleurs)
  writeFileSync(path.join(inst.work, 'scripts/update.sh'), '#!/usr/bin/env bash\necho "UPDATE.SH $*" >> "$AUDIT_LOG"\n', { mode: 0o755 })
  writeFileSync(path.join(inst.work, '.acra-update/snapshots.json'), JSON.stringify({ schema: 1, snapshots: [{ id: ID, reason: 'pre-update', createdAt: '2026-10-03T10:15:00Z', version: '1.0.4', verified: 'full', clone: true, documents: true, encrypted: false, sizeBytes: 1 }] }))
}
const request = (obj: unknown) => writeFileSync(path.join(inst.work, '.acra-update/inbox/request.json'), typeof obj === 'string' ? obj : JSON.stringify(obj))
const agent = () => inst.run('scripts/update-agent.sh', [])
const status = () => JSON.parse(readFileSync(path.join(inst.work, '.acra-update/status.json'), 'utf8'))
const updateCalls = () => inst.calls().filter(c => c.startsWith('UPDATE.SH'))

describe('update-agent.sh', () => {
  it('une demande sans action = mise à jour du canal', () => {
    setup(); request({ id: 'r', channel: 'beta' })
    expect(agent().status).toBe(0)
    expect(updateCalls()).toEqual(['UPDATE.SH beta --yes --status-file .acra-update/status.json'])
  })
  it('rollback : identifiant présent dans l’index ⇒ update.sh rollback <id> --yes', () => {
    setup(); request({ id: 'r', action: 'rollback', snapshotId: ID, confirmVersion: '1.0.4' })
    agent()
    expect(updateCalls()).toEqual([`UPDATE.SH rollback ${ID} --yes --status-file .acra-update/status.json`])
  })
  it('rollback : identifiant hors de l’index ⇒ FAILED invalid_request, update.sh jamais appelé', () => {
    setup(); request({ id: 'r', action: 'rollback', snapshotId: '20250101T000000Z-manual-9', confirmVersion: '9' })
    agent()
    expect(updateCalls()).toEqual([])
    expect(status()).toMatchObject({ state: 'FAILED', code: 'invalid_request' })
  })
  it('injection dans la demande neutralisée', () => {
    setup(); request(`{"action":"rollback","snapshotId":"${ID}\\"; rm -rf / #","confirmVersion":"1"}`)
    agent()
    expect(updateCalls()).toEqual([])
    expect(status().code).toBe('invalid_request')
    request({ id: 'r', channel: 'stable"; rm -rf /' })
    agent()
    expect(updateCalls()).toEqual([])
  })
  it('à chaque passage : un journal d’exécution interrompu déclenche la reprise', () => {
    setup(); mkdirSync(path.join(inst.work, '.acra-update/run'), { recursive: true })
    writeFileSync(path.join(inst.work, '.acra-update/run/current.json'), '{ "state": "MIGRATE" }')
    agent()
    expect(updateCalls()).toEqual(['UPDATE.SH resume --status-file .acra-update/status.json'])
  })
  it('un journal avec verrou vivant n’est pas repris', () => {
    setup(); mkdirSync(path.join(inst.work, '.acra-update/run/lock'), { recursive: true })
    writeFileSync(path.join(inst.work, '.acra-update/run/current.json'), '{ "state": "MIGRATE" }')
    writeFileSync(path.join(inst.work, '.acra-update/run/lock/pid'), String(process.pid))
    agent()
    expect(updateCalls()).toEqual([])
    expect(existsSync(path.join(inst.work, '.acra-update/inbox'))).toBe(true)
  })
})

describe('update-agent.sh — sauvegardes planifiées (lot S-plan)', () => {
  const stubSchedule = () => writeFileSync(path.join(inst.work, 'scripts/acra-schedule.sh'), '#!/usr/bin/env bash\necho "SCHEDULE $*" >> "$AUDIT_LOG"\n', { mode: 0o755 })
  const scheduleCalls = () => inst.calls().filter(c => c.startsWith('SCHEDULE'))
  const policyReq = (policy: string) => request(`{"id":"r","action":"backup-policy","policy":${policy},"requestedBy":"u","requestedAt":"2026-10-04T00:00:00.000Z"}`)
  const good = '{"daily":{"enabled":true,"keep":7},"weekly":{"enabled":true,"keep":4,"weekday":0},"monthly":{"enabled":true,"keep":6,"day":1},"hour":3}'
  const policyFile = () => path.join(inst.work, '.acra-update/backup-policy.json')

  it('chaque passage appelle le planificateur (sans demande en attente)', () => {
    setup(); stubSchedule()
    agent(); agent()
    expect(scheduleCalls()).toEqual(['SCHEDULE tick', 'SCHEDULE tick'])
  })

  it('demande backup-policy valide : fichier de politique écrit (mise en forme canonique, 0644), update.sh jamais appelé', () => {
    setup(); stubSchedule(); policyReq(good)
    agent()
    expect(readFileSync(policyFile(), 'utf8')).toBe('{\n  "schema": 1,\n  "daily": { "enabled": true, "keep": 7 },\n  "weekly": { "enabled": true, "keep": 4, "weekday": 0 },\n  "monthly": { "enabled": true, "keep": 6, "day": 1 },\n  "hour": 3\n}\n')
    expect(statSync(policyFile()).mode & 0o777).toBe(0o644)
    expect(updateCalls()).toEqual([])
  })

  it('politique invalide ou piégée : ignorée, fichier inchangé', () => {
    setup(); stubSchedule(); policyReq(good); agent()
    const before = readFileSync(policyFile(), 'utf8')
    for (const bad of [
      good.replace('"keep":7', '"keep":0'), good.replace('"hour":3', '"hour":24'), good.replace('"day":1', '"day":29'), good.replace('"weekday":0', '"weekday":7'),
      good.replace('"enabled":true,"keep":7', '"enabled":"$(rm -rf /)","keep":7'), good.replace('"keep":7', '"keep":"7; rm -rf /"'),
      '{"daily":{"enabled":false,"keep":3},"weekly":{"enabled":false,"keep":3,"weekday":0},"monthly":{"enabled":false,"keep":3,"day":1},"hour":2}',
    ]) { policyReq(bad); agent(); expect(readFileSync(policyFile(), 'utf8'), bad).toBe(before) }
    expect(updateCalls()).toEqual([])
  })
})

describe('update-agent.sh — demande backup-prune', () => {
  const stubSnap = () => writeFileSync(path.join(inst.work, 'scripts/acra-snapshot.sh'), '#!/usr/bin/env bash\necho "SNAP $*" >> "$AUDIT_LOG"\n', { mode: 0o755 })
  const snapCalls = () => inst.calls().filter(c => c.startsWith('SNAP'))
  const ID2 = '20261001T101500Z-manual-1.0.3'
  const withIndex = () => writeFileSync(path.join(inst.work, '.acra-update/snapshots.json'), JSON.stringify({ schema: 1, snapshots: [ID, ID2].map(id => ({ id, reason: 'manual', createdAt: '2026-10-03T10:15:00Z', version: '1.0.4', verified: 'full', clone: false, documents: true, encrypted: false, sizeBytes: 1 })) }))
  const prune = (ids: string[]) => request({ id: 'r', action: 'backup-prune', ids, requestedBy: 'u', requestedAt: '2026-10-05T00:00:00.000Z' })

  it('ids présents dans l’index de l’agent : prune --ids, puis rien d’autre (update.sh jamais appelé)', () => {
    setup(); stubSnap(); withIndex(); prune([ID, ID2])
    agent()
    expect(snapCalls()).toEqual([`SNAP prune --ids ${ID},${ID2}`])
    expect(updateCalls()).toEqual([])
  })
  it('identifiant hors index ou piégé : demande ignorée, rien n’est supprimé', () => {
    setup(); stubSnap(); withIndex()
    prune([ID, '20250101T000000Z-manual-9']); agent()
    prune([`${ID}"; rm -rf / #`]); agent()
    prune([]); agent()
    expect(snapCalls()).toEqual([])
  })
})

describe('update-agent.sh — mesure de l’hôte Docker (host-stats.json)', () => {
  const file = () => path.join(inst.work, '.acra-update/host-stats.json')
  it('publie docker system df assaini (types connus, sans noms d’image) à chaque passage au plus une fois par heure', () => {
    setup(); agent()
    const j = JSON.parse(readFileSync(file(), 'utf8'))
    expect(j.schema).toBe(1); expect(typeof j.at).toBe('string')
    expect(j.rows).toEqual([
      { type: 'Images', size: '12.3GB', reclaimable: '4.1GB (33%)' }, { type: 'Containers', size: '1MB', reclaimable: '0B (0%)' },
      { type: 'Local Volumes', size: '8GB', reclaimable: '0B (0%)' }, { type: 'Build Cache', size: '3GB', reclaimable: '3GB' },
    ])
    expect(statSync(file()).mode & 0o777).toBe(0o644)
    const n = inst.calls().filter(c => c.startsWith('system df')).length
    agent(); expect(inst.calls().filter(c => c.startsWith('system df')).length).toBe(n)
  })
  it('docker system df en échec : pas de fichier, l’agent continue', () => {
    setup(); inst.fakeFile('no_system_df'); expect(agent().status).toBe(0)
    expect(existsSync(file())).toBe(false)
  })
})
