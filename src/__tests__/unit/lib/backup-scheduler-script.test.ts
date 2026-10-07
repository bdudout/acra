// §4.3 de docs/specs/stockage-supervision-nettoyage.md : service compose `backup` — rétention par nombre, pas de dump au démarrage
// si un dump récent existe, compatibilité avec l'ancienne variable BACKUP_RETENTION (jours).
import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

let root = ''
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = '' })
const dumps = () => readdirSync(path.join(root, 'backups')).filter(f => f.endsWith('.sql.gz')).sort()

function setup(existing: Array<{ name: string; ageHours: number }>) {
  root = mkdtempSync(path.join(tmpdir(), 'acra-bk-'))
  const bin = path.join(root, 'bin'); mkdirSync(bin); mkdirSync(path.join(root, 'backups'))
  writeFileSync(path.join(bin, 'pg_isready'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  writeFileSync(path.join(bin, 'pg_dump'), '#!/bin/sh\necho "-- dump"\n', { mode: 0o755 })
  for (const e of existing) {
    const f = path.join(root, 'backups', e.name); writeFileSync(f, 'x')
    const t = new Date(Date.now() - e.ageHours * 3600_000); utimesSync(f, t, t)
  }
}
const env = (extra: Record<string, string>) => ({ ...process.env, PATH: `${path.join(root, 'bin')}:${process.env.PATH}`, POSTGRES_USER: 'u', POSTGRES_PASSWORD: 'p', POSTGRES_DB: 'd', BACKUP_DIR: path.join(root, 'backups'), BACKUP_OFFSITE_CMD: '', ...extra })
const run = (script: string, extra: Record<string, string>) => spawnSync('sh', [path.join(process.cwd(), 'scripts', script)], { env: env(extra), encoding: 'utf8', timeout: 60_000 })
const old = (n: number, ageHours: number) => ({ name: `ebios_2026-09-${String(n).padStart(2, '0')}_02-00-00.sql.gz`, ageHours })

describe('backup.sh — rétention', () => {
  it('BACKUP_KEEP : ne garde que les N dumps les plus récents (le nouveau compte), quel que soit leur âge', () => {
    setup([old(1, 1), old(2, 2), old(3, 3), old(4, 4)])
    const r = run('backup.sh', { BACKUP_KEEP: '3' })
    expect(r.status, r.stderr).toBe(0)
    const left = dumps()
    expect(left).toHaveLength(3)
    expect(left).toContain('ebios_2026-09-04_02-00-00.sql.gz')
    expect(left).not.toContain('ebios_2026-09-01_02-00-00.sql.gz')
  })
  it('compatibilité : sans BACKUP_KEEP, BACKUP_RETENTION (jours) s’applique comme avant', () => {
    setup([old(1, 24 * 10), old(2, 24 * 3)])
    expect(run('backup.sh', { BACKUP_RETENTION: '7' }).status).toBe(0)
    const left = dumps()
    expect(left).toContain('ebios_2026-09-02_02-00-00.sql.gz')
    expect(left).not.toContain('ebios_2026-09-01_02-00-00.sql.gz')
  })
  it('BACKUP_KEEP invalide : repli sur 7, jamais 0', () => {
    setup([old(1, 1), old(2, 2)])
    expect(run('backup.sh', { BACKUP_KEEP: '0' }).status).toBe(0)
    expect(dumps().length).toBe(3)
  })
})

describe('backup-scheduler.sh — dump au démarrage', () => {
  const sched = (extra: Record<string, string> = {}) => run('backup-scheduler.sh', { BACKUP_SCRIPT: path.join(process.cwd(), 'scripts/backup.sh'), BACKUP_SCHED_ONCE: '1', ...extra })
  it('aucun dump : sauvegarde immédiate', () => {
    setup([])
    const r = sched()
    expect(r.status).toBe(0)
    expect(dumps(), `${r.stdout}\n${r.stderr}`).toHaveLength(1)
  })
  it('dump de moins de 20 h : pas de nouveau dump au démarrage', () => {
    setup([old(1, 5)])
    const r = sched()
    expect(r.status).toBe(0)
    expect(dumps()).toHaveLength(1)
    expect(r.stdout).toMatch(/dump récent/)
  })
  it('dump de plus de 20 h : nouvelle sauvegarde', () => {
    setup([old(1, 21)])
    const r = sched()
    expect(dumps(), `${r.stdout}\n${r.stderr}`).toHaveLength(2)
  })
})
