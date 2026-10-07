// Lot 0 de docs/specs/sauvegarde-rollback-spec.md : correctifs urgents du update.sh (documents, sauvegarde vérifiée, révision servie).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { statSync, readdirSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { makeInstance, type Instance } from '../../helpers/update-fixture'

vi.setConfig({ testTimeout: 90_000 })
let inst: Instance
afterEach(() => inst?.cleanup())
const idx = (calls: string[], needle: string) => calls.findIndex(c => c.includes(needle))

describe('update.sh — documents persistants (C1)', () => {
  it('sans montage existant : docker cp AVANT up, puis compose cp APRÈS', () => {
    inst = makeInstance(); inst.fakeFile('mounts', '/app/.acra-update\n')
    const r = inst.run('scripts/update.sh', ['stable', '--yes'])
    expect(r.status, r.stderr + r.stdout).toBe(0)
    const c = inst.calls()
    const cp = c.findIndex(x => /^cp cid123:\/app\/\.data\/documents/.test(x))
    const up = idx(c, 'up -d --build')
    const back = c.findIndex(x => x.includes('compose') && x.includes(' cp ') && x.includes('app:/app/.data/documents'))
    expect(cp).toBeGreaterThanOrEqual(0)
    expect(up).toBeGreaterThan(cp)
    expect(back).toBeGreaterThan(up)
  })
  it('avec un montage déjà présent : sauvegarde aussi les documents, car un volume anonyme peut disparaître au changement de compose', () => {
    inst = makeInstance(); inst.fakeFile('mounts', '/app/.acra-update\n/app/.data/documents\n')
    const r = inst.run('scripts/update.sh', ['stable', '--yes'])
    expect(r.status, r.stderr).toBe(0)
    expect(inst.calls().some(x => /^cp cid123:\/app\/\.data\/documents/.test(x))).toBe(true)
  })
  it('si la restitution des documents sauvés échoue, annule la mise à jour plutôt que de confirmer une perte', () => {
    inst = makeInstance(); inst.fakeFile('mounts', '/app/.acra-update\n'); inst.fakeFile('rescue_copy_fail_once')
    const r = inst.run('scripts/update.sh', ['stable', '--yes', '--status-file', '.acra-update/status.json'])
    expect(r.status).not.toBe(0)
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
    expect(JSON.parse(inst.read('.acra-update/status.json'))).toMatchObject({ state: 'FAILED', rolledBack: true, code: 'documents_restore_failed' })
  })
  it('signale un rollback non sûr si la copie des documents échoue aussi vers la stable', () => {
    inst = makeInstance(); inst.fakeFile('rescue_copy_fail')
    const r = inst.run('scripts/update.sh', ['stable', '--yes', '--status-file', '.acra-update/status.json'])
    expect(r.status).not.toBe(0)
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
    expect(JSON.parse(inst.read('.acra-update/status.json'))).toMatchObject({ state: 'FAILED', rolledBack: false, code: 'rollback_failed' })
  })
})

describe('update.sh — sauvegarde vérifiée, application arrêtée, droits (C2, C3, C10)', () => {
  it('arrête app/scheduler/backup avant le dump, sauvegarde au format custom, fichiers 0600 et dossier 0700', () => {
    inst = makeInstance()
    const r = inst.run('scripts/update.sh', ['stable', '--yes'])
    expect(r.status, r.stderr).toBe(0)
    const c = inst.calls()
    const stop = idx(c, 'stop app scheduler backup')
    const dump = idx(c, 'pg_dump -Fc')
    expect(stop).toBeGreaterThanOrEqual(0)
    expect(dump).toBeGreaterThan(stop)
    const root = path.join(inst.work, 'backups')
    expect(statSync(root).mode & 0o777).toBe(0o700)
    const id = readdirSync(root).find(f => /^\d{8}T\d{6}Z-pre-update-1\.0\.4$/.test(f))!
    expect(id).toBeTruthy()
    const dir = path.join(root, id)
    expect(statSync(dir).mode & 0o777).toBe(0o700)
    for (const f of readdirSync(dir)) expect(statSync(path.join(dir, f)).mode & 0o777, f).toBe(0o600)
  })
  it('une sauvegarde tronquée arrête la mise à jour : ancienne app redémarrée, aucun merge', () => {
    inst = makeInstance(); inst.fakeFile('dump_fail')
    const r = inst.run('scripts/update.sh', ['stable', '--yes'])
    expect(r.status).not.toBe(0)
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
    const c = inst.calls()
    expect(c.some(x => x.includes('up -d --no-build app'))).toBe(true)
    expect(c.some(x => x.includes('up -d --build'))).toBe(false)
  })
  it('un dump que pg_restore --list ne sait pas lire est refusé (même effet)', () => {
    inst = makeInstance(); inst.fakeFile('list_fail')
    const r = inst.run('scripts/update.sh', ['stable', '--yes'])
    expect(r.status).not.toBe(0)
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
    expect(inst.calls().some(x => x.includes('up -d --no-build app'))).toBe(true)
  })
  it('un dump sans aucune entrée TABLE DATA est refusé', () => {
    inst = makeInstance(); inst.fakeFile('restore_list', '; Archive\n')
    const r = inst.run('scripts/update.sh', ['stable', '--yes'])
    expect(r.status).not.toBe(0)
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
  })
  it('l’échec indique que rien n’a été modifié', () => {
    inst = makeInstance(); inst.fakeFile('dump_fail')
    const r = inst.run('scripts/update.sh', ['stable', '--yes'])
    expect(r.stderr + r.stdout).toMatch(/rien n.a été modifié/)
  })
})

describe('update.sh — révision servie et migrations (C8, C13)', () => {
  it('exporte la version et la révision cibles et désactive la réconciliation automatique', () => {
    inst = makeInstance()
    inst.run('scripts/update.sh', ['stable', '--yes'])
    const env = inst.calls().find(c => c.startsWith('ENV ACRA_VERSION'))
    expect(env).toContain('ACRA_VERSION=v1.0.5')
    expect(env).toContain(`ACRA_REVISION=${inst.shaB}`)
    expect(env).toContain('RESOLVE=0')
    expect(inst.calls()).toContain('ENV MIGRATOR RESOLVE=0')
  })
  it('refuse le succès si /api/health ne renvoie pas la révision cible (ancien conteneur)', () => {
    inst = makeInstance(); inst.fakeFile('no_serve')
    const r = inst.run('scripts/update.sh', ['stable', '--yes', '--status-file', '.acra-update/status.json'])
    expect(r.status).not.toBe(0)
  })
})

describe('configuration', () => {
  it('docker-compose.yml monte le volume documents_data et le déclare', () => {
    const y = readFileSync('docker-compose.yml', 'utf8')
    expect(y).toContain('documents_data:/app/.data/documents')
    expect(y).toMatch(/^\s*documents_data:/m)
    expect(y).toContain('ACRA_VERSION: ${ACRA_VERSION:-development}')
    expect(y).toContain('ACRA_REVISION: ${ACRA_REVISION:-unknown}')
    expect(y).toContain('ACRA_MIGRATE_AUTO_RESOLVE: ${ACRA_MIGRATE_AUTO_RESOLVE:-1}')
  })
})

describe('migrate-recover.sh — ACRA_MIGRATE_AUTO_RESOLVE=0', () => {
  function runRecover(autoResolve: string) {
    const dir = mkdtempSync(path.join(tmpdir(), 'acra-mig-'))
    try {
      mkdirSync(path.join(dir, 'node_modules/prisma/build'), { recursive: true })
      writeFileSync(path.join(dir, 'node_modules/prisma/build/index.js'),
        `const a=process.argv.slice(2);require('fs').appendFileSync(process.env.AUDIT_LOG,a.join(' ')+'\\n');` +
        `if(a[1]==='status'){console.log('Following migration have failed: 20260101000000_x');}`)
      const log = path.join(dir, 'calls'); writeFileSync(log, '')
      spawnSync('sh', [path.resolve('scripts/migrate-recover.sh')], { cwd: dir, env: { ...process.env, AUDIT_LOG: log, ACRA_MIGRATE_AUTO_RESOLVE: autoResolve }, encoding: 'utf8' })
      return readFileSync(log, 'utf8')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  }
  it('0 : jamais de migrate resolve, directement migrate deploy', () => {
    const calls = runRecover('0')
    expect(calls).not.toContain('resolve')
    expect(calls).toContain('migrate deploy')
  })
  it('1 (défaut) : la réconciliation reste possible', () => {
    expect(runRecover('1')).toContain('resolve --applied 20260101000000_x')
  })
})
