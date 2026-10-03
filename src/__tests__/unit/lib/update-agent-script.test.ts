// Lot 3 — scripts/update-agent.sh : demandes `rollback` (identifiant validé contre SON index) et reprise à chaque passage.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
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
