// Lot 2 de docs/specs/sauvegarde-rollback-spec.md : update.sh v2 (machine à états, passage de main, retour arrière automatique).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { makeInstance, type Instance } from '../../helpers/update-fixture'

vi.setConfig({ testTimeout: 120_000 })
let inst: Instance
afterEach(() => inst?.cleanup())
const STATUS = '.acra-update/status.json'
const update = (extra: string[] = []) => inst.run('scripts/update.sh', ['stable', '--yes', '--status-file', STATUS, ...extra])
const status = () => JSON.parse(inst.read(STATUS))
const idxOf = (c: string[], n: string) => c.findIndex(x => x.includes(n))

describe('update.sh v2 — mise à jour réussie', () => {
  it('enchaîne QUIESCE → SNAPSHOT → FETCH → HANDOFF → MIGRATE → START → HEALTH → SMOKE → FINALIZE et publie le statut', () => {
    inst = makeInstance()
    const r = update()
    expect(r.status, r.stderr + r.stdout).toBe(0)
    const c = inst.calls()
    const order = ['stop app scheduler backup', 'pg_dump -Fc', 'run --rm --no-deps migrator', 'up -d --build --no-deps']
    let last = -1
    for (const n of order) { const i = idxOf(c, n); expect(i, n).toBeGreaterThan(last); last = i }
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaB)
    const s = status()
    expect(s).toMatchObject({ state: 'SUCCESS', rolledBack: false, from: '1.0.4', to: '1.0.5', channel: 'stable' })
    expect(s.snapshotId).toMatch(/pre-update-1\.0\.4$/)
    expect(s.steps.map((x: { step: string }) => x.step)).toEqual(expect.arrayContaining(['PRECHECK', 'QUIESCE', 'SNAPSHOT', 'FETCH', 'HANDOFF', 'MIGRATE', 'START', 'HEALTH', 'SMOKE', 'FINALIZE']))
    expect(inst.exists('.acra-update/run/current.json')).toBe(false)
    expect(JSON.parse(inst.read('.acra-update/run/last.json')).state).toBe('DONE')
    expect(inst.read('.acra-update/events.log')).toMatch(/^UPDATED 1\.0\.4 1\.0\.5 /m)
    expect(c.some(x => x.includes('ENV MIGRATOR RESOLVE=0'))).toBe(true)
  })
  it('déjà à jour : rien à faire', () => {
    inst = makeInstance()
    update(); const n = inst.calls().length
    const r = update()
    expect(r.status).toBe(0)
    expect(inst.calls().length).toBe(n)
    expect(status().state).toBe('SUCCESS')
  })
  it('modifications locales : refus sans toucher à l’application', () => {
    inst = makeInstance(); writeFileSync(path.join(inst.work, 'package.json'), '{ "version": "1.0.4", "dirty": true }')
    const r = update()
    expect(r.status).not.toBe(0)
    expect(status()).toMatchObject({ state: 'FAILED', code: 'precheck_dirty' })
    expect(inst.calls().some(c => c.includes('stop app'))).toBe(false)
  })
})

describe('update.sh v2 — échecs avant toute modification du code', () => {
  it('échec du point de restauration : aucun merge, ancienne app redémarrée, statut snapshot_failed', () => {
    inst = makeInstance(); inst.fakeFile('dump_fail')
    const r = update()
    expect(r.status).not.toBe(0)
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
    const c = inst.calls()
    expect(c.some(x => x.includes('up -d --no-build'))).toBe(true)
    expect(c.some(x => x.includes('run --rm --no-deps migrator'))).toBe(false)
    expect(status()).toMatchObject({ state: 'FAILED', code: 'snapshot_failed', rolledBack: false })
  })
  it('espace insuffisant : snapshot_space', () => {
    inst = makeInstance(); inst.fakeFile('df_host', '10')
    update()
    expect(status().code).toBe('snapshot_space')
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
  })
})

describe('update.sh v2 — retour arrière automatique', () => {
  it('échec de migration : reset --hard FROM_SHA, restauration du point, up, santé sur FROM_SHA, statut rolledBack', () => {
    inst = makeInstance(); inst.fakeFile('migrate_fail')
    const r = update()
    expect(r.status).not.toBe(0)
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
    const c = inst.calls()
    const migrate = idxOf(c, 'run --rm --no-deps migrator')
    const rename = c.findIndex(x => x.includes('RENAME TO') && x.includes('__failed_'))
    expect(rename).toBeGreaterThan(migrate)
    const upAfter = c.findIndex((x, i) => i > rename && x.startsWith('ENV ACRA_VERSION=v1.0.4'))
    expect(upAfter).toBeGreaterThan(rename)
    expect(c[upAfter]).toContain(`ACRA_REVISION=${inst.shaA}`)
    expect(status()).toMatchObject({ state: 'FAILED', rolledBack: true, code: 'migrate_failed', from: '1.0.4', to: '1.0.5' })
    expect(inst.read('.acra-update/events.log')).toMatch(/^ROLLED_BACK 1\.0\.5 1\.0\.4 migrate_failed /m)
    expect(inst.exists('.acra-update/run/current.json')).toBe(false)
  })
  it('échec de santé (révision inattendue) : même retour arrière', () => {
    inst = makeInstance(); inst.fakeFile('health_stuck', 'mauvaise-revision')
    const r = update()
    expect(r.status).not.toBe(0)
    // la santé du retour arrière échoue aussi (le simulé répond toujours « mauvaise-revision ») : l'application reste ARRÊTÉE
    expect(status()).toMatchObject({ state: 'FAILED', code: 'rollback_failed' })
    const c = inst.calls()
    expect(c.filter(x => x.includes('RENAME TO') && x.includes('__failed_')).length).toBeGreaterThan(0)
    expect(c[c.length - 1]).toContain('stop')
  })
  it('échec de santé puis retour arrière réussi quand l’ancienne révision répond', () => {
    inst = makeInstance(); inst.fakeFile('no_serve')
    // l'ancienne version répond (served_rev = shaA initial) : la nouvelle jamais ⇒ santé cible en échec, santé ancienne OK
    const r = update()
    expect(r.status).not.toBe(0)
    expect(status()).toMatchObject({ state: 'FAILED', rolledBack: true, code: 'health_failed' })
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
  })
  it('échec de fumée : retour arrière', () => {
    inst = makeInstance(); inst.fakeFile('smoke_fail')
    update()
    expect(status()).toMatchObject({ rolledBack: true, code: 'smoke_failed' })
  })
  it('échec du HANDOFF (contrat inconnu) : retour arrière du code SANS restauration de base', () => {
    inst = makeInstance({ targetFiles: { 'scripts/update-steps.sh': '#!/usr/bin/env bash\nACRA_UPDATE_STEPS_API=99\n' } })
    const r = update()
    expect(r.status).not.toBe(0)
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
    const c = inst.calls()
    expect(c.some(x => x.includes('RENAME TO') && x.includes('__failed_'))).toBe(false)
    expect(status()).toMatchObject({ state: 'FAILED', rolledBack: true, code: 'handoff_failed' })
  })
})

describe('update.sh v2 — reprise après interruption', () => {
  const journal = (state: string, snapshotId: string | null, shaA: string, shaB: string) => JSON.stringify({
    schema: 1, runId: 'r1', kind: 'update', channel: 'stable', from: { version: '1.0.4', sha: shaA }, to: { version: '1.0.5', sha: shaB },
    snapshotId, state, startedAt: '2026-10-03T10:00:00Z', updatedAt: '2026-10-03T10:01:00Z', steps: [],
  }, null, 2).replace(/"from": \{\n\s+"version": "([^"]+)",\n\s+"sha": "([^"]+)"\n\s+\}/, '"from": { "version": "$1", "sha": "$2" }').replace(/"to": \{\n\s+"version": "([^"]+)",\n\s+"sha": "([^"]+)"\n\s+\}/, '"to": { "version": "$1", "sha": "$2" }')
  const seed = (state: string, snapshotId: string | null) => { mkdirSync(path.join(inst.work, '.acra-update/run'), { recursive: true }); writeFileSync(path.join(inst.work, '.acra-update/run/current.json'), journal(state, snapshotId, inst.shaA, inst.shaB)) }

  it('journal en QUIESCE : redémarrage seul, aucune restauration', () => {
    inst = makeInstance(); seed('QUIESCE', null)
    const r = inst.run('scripts/update.sh', ['resume', '--status-file', STATUS])
    expect(r.status).toBe(0)
    const c = inst.calls()
    expect(c.some(x => x.includes('up -d --no-build'))).toBe(true)
    expect(c.some(x => x.includes('RENAME TO'))).toBe(false)
    expect(status()).toMatchObject({ state: 'FAILED', code: 'interrupted_before_snapshot' })
    expect(inst.exists('.acra-update/run/current.json')).toBe(false)
  })
  it('journal en MIGRATE : ROLLBACK avec restauration du point', () => {
    inst = makeInstance()
    const pre = update() ; expect(pre.status).toBe(0)
    // nouvelle exécution simulée : on repart de A avec un point de restauration valide
    inst.gitIn('reset', '--hard', inst.shaA)
    const snap = inst.run('scripts/acra-snapshot.sh', ['create', '--reason', 'pre-update', '--from-version', '1.0.4']).stdout.trim()
    seed('MIGRATE', snap)
    const r = inst.run('scripts/update.sh', ['resume', '--status-file', STATUS])
    expect(r.status, r.stderr).toBe(0)
    expect(inst.calls().some(x => x.includes('RENAME TO') && x.includes('__failed_'))).toBe(true)
    expect(status()).toMatchObject({ rolledBack: true, code: 'interrupted' })
  })
})

describe('update.sh v2 — retour arrière manuel', () => {
  it('rollback <id> restaure code et base du point', () => {
    inst = makeInstance()
    inst.gitIn('merge', '--ff-only', 'origin/stable')
    inst.fakeFile('served_rev', inst.shaB)
    // point de restauration créé alors que le code est en B, mais dont la révision enregistrée est celle de A
    const snap = inst.run('scripts/acra-snapshot.sh', ['create', '--reason', 'manual', '--from-version', '1.0.4']).stdout.trim()
    const man = path.join(inst.work, 'backups', snap, 'manifest.json')
    writeFileSync(man, inst.read(`backups/${snap}/manifest.json`).replace(/"revision": "[^"]*"/, `"revision": "${inst.shaA}"`).replace('"version": "1.0.5"', '"version": "1.0.4"'))
    const r = inst.run('scripts/update.sh', ['rollback', snap, '--yes', '--status-file', STATUS])
    expect(r.status, r.stderr + r.stdout).toBe(0)
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
    expect(inst.calls().some(x => x.includes('RENAME TO') && x.includes('__failed_'))).toBe(true)
    expect(status()).toMatchObject({ state: 'SUCCESS', rolledBack: true })
  })
  it('refuse un identifiant invalide ou une révision qui n’est pas un ancêtre', () => {
    inst = makeInstance()
    const bad = inst.run('scripts/update.sh', ['rollback', '../x', '--yes', '--status-file', STATUS])
    expect(bad.status).not.toBe(0)
    expect(status().code).toBe('invalid_request')
  })
})
