// Sauvegarde externe (docs/specs/sauvegarde-externe-proposition.md, lot S1) : scripts/acra-offsite.sh, pilotes fs et command.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { makeInstance, listDir, type Instance } from '../../helpers/update-fixture'

vi.setConfig({ testTimeout: 120_000 })
let inst: Instance
afterEach(() => inst?.cleanup())
const make = () => makeInstance({ scripts: ['update.sh', 'acra-snapshot.sh', 'acra-offsite.sh'] })
const snap = (args: string[], env?: Record<string, string>) => inst.run('scripts/acra-snapshot.sh', args, env)
const off = (args: string[], env?: Record<string, string>) => inst.run('scripts/acra-offsite.sh', args, env)
const create = (env?: Record<string, string>) => { const r = snap(['create', '--reason', 'pre-update', '--from-version', '1.0.4'], env); expect(r.status, r.stderr).toBe(0); return r.stdout.trim() }
const target = () => path.join(inst.root, 'offsite')
const fsEnv = (extra: Record<string, string> = {}) => ({ ACRA_OFFSITE_DRIVER: 'fs', ACRA_OFFSITE_TARGET: target(), ...extra })
const state = () => JSON.parse(inst.read('.acra-update/offsite.json'))

describe('acra-offsite push — pilote fs', () => {
  it('copie le point, vérifie les empreintes côté cible et publie offsite.json', () => {
    inst = make(); const id = create()
    const r = off(['push', id], fsEnv())
    expect(r.status, r.stderr).toBe(0)
    expect(readdirSync(path.join(target(), id)).sort()).toEqual(['SHA256SUMS', 'create.log', 'database.dump', 'documents.tar.gz', 'manifest.json'])
    expect(readFileSync(path.join(target(), id, 'database.dump'), 'utf8')).toBe(readFileSync(path.join(inst.work, 'backups', id, 'database.dump'), 'utf8'))
    const s = state()
    expect(s).toMatchObject({ schema: 1, driver: 'fs', lastSnapshotId: id, lastCode: 0 })
    expect(Date.parse(s.lastSuccessAt)).toBeGreaterThan(0)
    expect(JSON.stringify(s)).not.toContain(target())
    expect(statSync(path.join(inst.work, '.acra-update/offsite.json')).mode & 0o777).toBe(0o644)
    expect(listDir(target()).filter(x => x.startsWith('.tmp'))).toEqual([])
  })

  it('une copie corrompue est détectée (code 51), rien ne reste sur la cible, l’échec est publié', () => {
    inst = make(); const id = create()
    writeFileSync(path.join(inst.bin, 'cp'), '#!/bin/sh\n/bin/cp "$@"\nfor last; do :; done\nfind "$last" -name database.dump | while read -r f; do echo CORROMPU > "$f"; done\n', { mode: 0o755 })
    const r = off(['push', id], fsEnv())
    expect(r.status).toBe(51)
    expect(existsSync(path.join(target(), id))).toBe(false)
    expect(listDir(target()).filter(x => x.startsWith('.tmp'))).toEqual([])
    expect(state()).toMatchObject({ lastCode: 51 })
    expect(state().lastFailureAt).toBeTruthy()
  })

  it('cible illisible ou non définie : code 10', () => {
    inst = make(); const id = create()
    expect(off(['push', id], { ACRA_OFFSITE_DRIVER: 'fs' }).status).toBe(10)
    expect(off(['push', id], { ACRA_OFFSITE_DRIVER: 'inconnu' }).status).toBe(10)
    expect(off(['push', id], {}).status).toBe(10)
  })

  it('identifiant invalide : 31, aucun accès à la cible', () => {
    inst = make()
    expect(off(['push', '../x'], fsEnv()).status).toBe(31)
    expect(off(['push', '20250101T000000Z-manual-9'], fsEnv()).status).toBe(31)
    expect(existsSync(target())).toBe(false)
  })

  it('rétention : ne garde que les N derniers points sur la cible', () => {
    inst = make()
    for (const n of ['20261001T000000Z-pre-update-1.0.1', '20261002T000000Z-pre-update-1.0.2', '20261003T000000Z-pre-update-1.0.3']) mkdirSync(path.join(target(), n), { recursive: true })
    const id = create()
    const r = off(['push', id], fsEnv({ ACRA_OFFSITE_KEEP: '2' }))
    expect(r.status, r.stderr).toBe(0)
    const left = readdirSync(target()).filter(x => !x.startsWith('.')).sort()
    expect(left).toHaveLength(2)
    expect(left).toContain(id)
  })

  it('fetch : rapatrie un point depuis la cible, vérifié, droits 0600/0700', () => {
    inst = make(); const id = create()
    off(['push', id], fsEnv())
    rmSync(path.join(inst.work, 'backups', id), { recursive: true })
    const r = off(['fetch', id], fsEnv())
    expect(r.status, r.stderr).toBe(0)
    const dir = path.join(inst.work, 'backups', id)
    expect(statSync(dir).mode & 0o777).toBe(0o700)
    expect(statSync(path.join(dir, 'database.dump')).mode & 0o777).toBe(0o600)
    expect(snap(['verify', id]).status).toBe(0)
  })

  it('fetch refuse d’écraser un point local existant et signale une cible sans ce point', () => {
    inst = make(); const id = create()
    off(['push', id], fsEnv())
    expect(off(['fetch', id], fsEnv()).status).toBe(53)
    rmSync(path.join(target(), id), { recursive: true })
    rmSync(path.join(inst.work, 'backups', id), { recursive: true })
    expect(off(['fetch', id], fsEnv()).status).toBe(53)
  })

  it('test : écrit, relit et supprime un fichier sonde sur la cible', () => {
    inst = make()
    mkdirSync(target(), { recursive: true })
    expect(off(['test'], fsEnv()).status).toBe(0)
    expect(readdirSync(target())).toEqual([])
    expect(off(['test'], fsEnv({ ACRA_OFFSITE_TARGET: '/proc/inexistant/acra' })).status).toBe(10)
  })
})

describe('acra-offsite push — pilote command et chiffrement', () => {
  const ageBin = () => writeFileSync(path.join(inst.bin, 'age'), '#!/bin/sh\nwhile [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift ;; esac; last="$1"; shift; done\ncp "$last" "$out"\n', { mode: 0o755 })
  const hook = () => { const f = path.join(inst.root, 'push.sh'); writeFileSync(f, '#!/bin/sh\necho "PUSHCMD id=$ACRA_SNAPSHOT_ID dir=$ACRA_SNAPSHOT_DIR" >> "$AUDIT_LOG"\n[ -e "$FAKE_DIR/push_fail" ] && exit 1\nexit 0\n', { mode: 0o755 }); return f }

  it('un point NON chiffré n’est jamais envoyé par command (code 52) sans autorisation explicite', () => {
    inst = make(); const id = create(); const cmd = hook()
    const r = off(['push', id], { ACRA_OFFSITE_DRIVER: 'command', ACRA_OFFSITE_CMD: cmd })
    expect(r.status).toBe(52)
    expect(inst.calls().some(c => c.startsWith('PUSHCMD'))).toBe(false)
    expect(state()).toMatchObject({ lastCode: 52 })
    const ok = off(['push', id], { ACRA_OFFSITE_DRIVER: 'command', ACRA_OFFSITE_CMD: cmd, ACRA_OFFSITE_ALLOW_PLAINTEXT: '1' })
    expect(ok.status, ok.stderr).toBe(0)
  })

  it('point chiffré : la commande reçoit l’identifiant et le dossier, un échec est publié (code 50)', () => {
    inst = make(); ageBin(); const cmd = hook()
    const id = create({ ACRA_BACKUP_AGE_RECIPIENT: 'age1xyz' })
    const r = off(['push', id], { ACRA_OFFSITE_DRIVER: 'command', ACRA_OFFSITE_CMD: cmd })
    expect(r.status, r.stderr).toBe(0)
    expect(inst.calls().some(c => c === `PUSHCMD id=${id} dir=${path.join(inst.work, 'backups', id)}`)).toBe(true)
    inst.fakeFile('push_fail')
    expect(off(['push', id], { ACRA_OFFSITE_DRIVER: 'command', ACRA_OFFSITE_CMD: cmd }).status).toBe(50)
    expect(state()).toMatchObject({ lastCode: 50 })
  })

  it('commande absente ou non exécutable : code 10', () => {
    inst = make(); const id = create()
    expect(off(['push', id], { ACRA_OFFSITE_DRIVER: 'command', ACRA_OFFSITE_ALLOW_PLAINTEXT: '1' }).status).toBe(10)
  })
})

describe('intégration à acra-snapshot create et statut', () => {
  it('create envoie automatiquement vers la cible ; un échec d’envoi ne fait jamais échouer le point', () => {
    inst = make()
    const id = create(fsEnv())
    expect(existsSync(path.join(target(), id, 'manifest.json'))).toBe(true)
    const id2 = (() => { const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4'], fsEnv({ ACRA_OFFSITE_TARGET: '/proc/inexistant/acra' })); expect(r.status, r.stderr).toBe(0); expect(r.stderr).toMatch(/Envoi hors site en échec/); return r.stdout.trim() })()
    expect(existsSync(path.join(inst.work, 'backups', id2, 'manifest.json'))).toBe(true)
  })

  it('status : dernier envoi et âge ; en retard au-delà de ACRA_OFFSITE_MAX_AGE_HOURS', () => {
    inst = make(); const id = create()
    off(['push', id], fsEnv())
    expect(off(['status'], fsEnv()).stdout).toMatch(/OK/)
    const file = path.join(inst.work, '.acra-update/offsite.json')
    writeFileSync(file, readFileSync(file, 'utf8').replace(/"lastSuccessAt": "[^"]*"/, '"lastSuccessAt": "2020-01-01T00:00:00Z"'))
    expect(off(['status'], fsEnv({ ACRA_OFFSITE_MAX_AGE_HOURS: '48' })).stdout).toMatch(/EN RETARD/)
  })
})
