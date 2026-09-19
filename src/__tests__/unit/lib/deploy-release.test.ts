import { it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
const script = path.resolve('scripts/deploy-release.sh')
function exercise(previousHash: string, pendingHash: string) {
 const dir = mkdtempSync(path.join(tmpdir(), 'acra-deploy-test-'))
 try {
  mkdirSync(path.join(dir, 'bin')); mkdirSync(path.join(dir, '.release-state'))
  writeFileSync(path.join(dir, 'bin/docker'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$AUDIT_LOG"\n', { mode: 0o755 })
  writeFileSync(path.join(dir, 'bin/flock'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  const state = (version: string, hash: string) => `ghcr.io/bdudout/acra@sha256:${'a'.repeat(64)}\n${version}\n${'b'.repeat(40)}\n${hash}\n`
  writeFileSync(path.join(dir, '.release-state/previous'), state('v1.0.0', previousHash))
  writeFileSync(path.join(dir, '.release-state/pending'), state('v1.0.1', pendingHash))
  const log = path.join(dir, 'calls')
  const result = spawnSync('bash', [script, 'rollback'], { cwd: dir, env: { ...process.env, PATH: `${dir}/bin:${process.env.PATH}`, AUDIT_LOG: log }, encoding: 'utf8' })
  return { status: result.status, calls: readFileSync(log, 'utf8') }
 } finally { rmSync(dir, { recursive: true, force: true }) }
}
it('revient à l’image précédente sans rejouer les migrations si le schéma est identique', () => {
 const r = exercise('c'.repeat(64), 'c'.repeat(64))
 expect(r.status).toBe(0)
 expect(r.calls).toContain('--no-deps --wait app')
 expect(r.calls).not.toContain('migrator')
})
it('refuse un retour aveugle après changement de migrations et arrête l’application', () => {
 const r = exercise('c'.repeat(64), 'd'.repeat(64))
 expect(r.status).not.toBe(0)
 expect(r.calls).toContain('stop app')
 expect(r.calls).not.toContain('up -d')
})
