// Lot 1 de docs/specs/sauvegarde-rollback-spec.md : scripts/acra-snapshot.sh (docker/psql/df simulés).
import { describe, it, expect, afterEach } from 'vitest'
import { statSync, readdirSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { makeInstance, listDir, type Instance } from '../../helpers/update-fixture'

let inst: Instance
afterEach(() => inst?.cleanup())
const make = () => makeInstance({ scripts: ['update.sh', 'acra-snapshot.sh'] })
const snap = (args: string[], env?: Record<string, string>) => inst.run('scripts/acra-snapshot.sh', args, env)
const backups = () => path.join(inst.work, 'backups')
const created = () => { const r = snap(['create', '--reason', 'pre-update', '--from-version', '1.0.4', '--to-version', '1.0.5']); expect(r.status, r.stderr).toBe(0); return r.stdout.trim() }

describe('acra-snapshot create', () => {
  it('crée un point complet : dump, documents, SHA256SUMS, manifeste, index ; droits 0700/0600', () => {
    inst = make()
    const id = created()
    expect(id).toMatch(/^\d{8}T\d{6}Z-pre-update-1\.0\.4$/)
    const dir = path.join(backups(), id)
    expect(readdirSync(dir).sort()).toEqual(['SHA256SUMS', 'create.log', 'database.dump', 'documents.tar.gz', 'manifest.json'])
    expect(statSync(dir).mode & 0o777).toBe(0o700)
    for (const f of readdirSync(dir)) expect(statSync(path.join(dir, f)).mode & 0o777, f).toBe(0o600)
    const m = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
    expect(m.schema).toBe(1); expect(m.id).toBe(id); expect(m.acra.version).toBe('1.0.4'); expect(m.acra.toVersion).toBe('1.0.5')
    expect(m.database.name).toBe('acra_rm'); expect(m.database.rowCounts.User).toBe(5); expect(m.documents.included).toBe(true)
    expect(m.verification).toMatchObject({ level: 'full', ok: true })
    const index = JSON.parse(inst.read('.acra-update/snapshots.json'))
    expect(index.snapshots[0]).toMatchObject({ id, reason: 'pre-update', version: '1.0.4', toVersion: '1.0.5', verified: 'full', documents: true })
    expect(JSON.stringify(index)).not.toMatch(/acra_rm|backups\//)
    expect(statSync(path.join(inst.work, '.acra-update/snapshots.json')).mode & 0o777).toBe(0o644)
  })

  it('refuse un pre-update si des connexions applicatives sont ouvertes (aucun dump, aucun résidu)', () => {
    inst = make(); inst.fakeFile('activity', '3')
    const r = snap(['create', '--reason', 'pre-update', '--from-version', '1.0.4'])
    expect(r.status).toBe(10)
    expect(inst.calls().some(c => c.includes('pg_dump'))).toBe(false)
    expect(listDir(backups()).filter(x => !x.startsWith('.'))).toEqual([])
  })

  it('un point manual avertit seulement', () => {
    inst = make(); inst.fakeFile('activity', '3')
    const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4'])
    expect(r.status, r.stderr).toBe(0)
    expect(r.stderr).toMatch(/connexion/)
  })

  it('saute le clone si l’espace du volume PostgreSQL est insuffisant, mais réussit', () => {
    inst = make(); inst.fakeFile('pg_free', '1000')
    const id = created()
    expect(inst.calls().some(c => c.includes('CREATE DATABASE') && c.includes('__snap_'))).toBe(false)
    expect(readFileSync(path.join(backups(), id, 'manifest.json'), 'utf8')).toMatch(/"clone": null/)
  })

  it('crée un clone quand l’espace le permet', () => {
    inst = make()
    const id = created()
    expect(inst.calls().some(c => c.includes('CREATE DATABASE') && c.includes('__snap_') && c.includes('STRATEGY FILE_COPY'))).toBe(true)
    expect(readFileSync(path.join(backups(), id, 'manifest.json'), 'utf8')).toMatch(/"clone": "acra_rm__snap_/)
  })

  it('un échec du clone n’est pas bloquant', () => {
    inst = make(); inst.fakeFile('clone_fail')
    const id = created()
    expect(readFileSync(path.join(backups(), id, 'manifest.json'), 'utf8')).toMatch(/"clone": null/)
  })

  it('refuse (11) si l’espace de ACRA_BACKUP_DIR est insuffisant, sans fichier résiduel', () => {
    inst = make(); inst.fakeFile('df_host', '10')
    const r = snap(['create', '--reason', 'pre-update', '--from-version', '1.0.4'])
    expect(r.status).toBe(11)
    expect(listDir(backups()).filter(x => !x.startsWith('.'))).toEqual([])
  })

  it('vérification rapide en échec ⇒ dossier .invalid, code 21', () => {
    inst = make(); inst.fakeFile('list_fail')
    const r = snap(['create', '--reason', 'pre-update', '--from-version', '1.0.4'])
    expect(r.status).toBe(21)
    expect(listDir(backups()).some(x => x.endsWith('.invalid'))).toBe(true)
    expect(!inst.exists('.acra-update/snapshots.json') || JSON.parse(inst.read('.acra-update/snapshots.json')).snapshots.length === 0).toBe(true)
  })

  it('le manifeste est écrit en dernier : un échec après le dump ne laisse pas de manifeste', () => {
    inst = make()
    const r = snap(['create', '--reason', 'pre-update', '--from-version', '1.0.4'], { ACRA_BACKUP_AGE_RECIPIENT: 'age1xxx', PATH: `${inst.bin}:/usr/bin:/bin` })
    expect(r.status).toBe(10)
    expect(listDir(backups()).filter(x => !x.startsWith('.'))).toEqual([])
  })

  it('un dump en échec (code 20) ne laisse rien', () => {
    inst = make(); inst.fakeFile('dump_fail')
    const r = snap(['create', '--reason', 'pre-update', '--from-version', '1.0.4'])
    expect(r.status).toBe(20)
    expect(listDir(backups()).filter(x => !x.startsWith('.'))).toEqual([])
  })

  it('identifiant et raison invalides ⇒ usage (2)', () => {
    inst = make()
    expect(snap(['create', '--reason', 'hack']).status).toBe(2)
    expect(snap(['create', '--reason', 'manual', '--from-version', '../x']).status).toBe(2)
  })

  it('verrou détenu ⇒ 40 ; verrou orphelin repris', () => {
    inst = make()
    mkdirSync(path.join(backups(), '.lock'), { recursive: true }); writeFileSync(path.join(backups(), '.lock/pid'), String(process.pid))
    expect(snap(['create', '--reason', 'manual', '--from-version', '1.0.4']).status).toBe(40)
    writeFileSync(path.join(backups(), '.lock/pid'), '999999')
    expect(snap(['create', '--reason', 'manual', '--from-version', '1.0.4']).status).toBe(0)
  })
})

describe('acra-snapshot restore', () => {
  it('renomme TOUJOURS la base courante en __failed_, remet le clone en place et publie l’événement', () => {
    inst = make()
    const id = created()
    const r = snap(['restore', id, '--yes'])
    expect(r.status, r.stderr).toBe(0)
    const c = inst.calls()
    const rename = c.findIndex(x => x.includes('RENAME TO') && x.includes('__failed_'))
    const clone = c.findIndex(x => x.includes('RENAME TO "acra_rm"') && x.includes('__snap_'))
    expect(rename).toBeGreaterThanOrEqual(0); expect(clone).toBeGreaterThan(rename)
    expect(c.some(x => x.includes('DROP DATABASE') && x.includes('__failed_'))).toBe(false)
    expect(c.findIndex(x => x.includes('stop app scheduler backup'))).toBeLessThan(rename)
    expect(inst.read('.acra-update/events.log')).toMatch(new RegExp(`^RESTORED ${id} `, 'm'))
    expect(readFileSync(path.join(backups(), id, 'manifest.json'), 'utf8')).toMatch(/"clone": null/)
  })

  it('sans clone : createdb + pg_restore --exit-on-error depuis le dump', () => {
    inst = make(); inst.fakeFile('clone_fail')
    const id = created()
    expect(snap(['restore', id, '--yes']).status).toBe(0)
    const c = inst.calls()
    expect(c.some(x => x.includes('CREATE DATABASE "acra_rm"'))).toBe(true)
    expect(c.some(x => x.includes('pg_restore -U') && x.includes('--exit-on-error'))).toBe(true)
  })

  it('comptes divergents ⇒ code 30 et la base renommée est remise en place', () => {
    inst = make()
    const id = created()
    inst.fakeFile('rows2_User', '999')
    const r = snap(['restore', id, '--yes'])
    expect(r.status).toBe(30)
    const c = inst.calls()
    expect(c.some(x => x.includes('RENAME TO "acra_rm"') && x.includes('__failed_'))).toBe(true)
  })

  it('dump en échec à la restauration ⇒ 30 et base précédente remise en place', () => {
    inst = make(); inst.fakeFile('clone_fail')
    const id = created()
    inst.fakeFile('restore_fail')
    expect(snap(['restore', id, '--yes']).status).toBe(30)
    expect(inst.calls().filter(x => x.includes('RENAME TO "acra_rm"')).length).toBeGreaterThan(0)
  })

  it('empreinte de clé différente ⇒ 32 ; acceptée avec --yes', () => {
    inst = make(); writeFileSync(path.join(inst.work, '.env'), 'SECRETS_ENCRYPTION_KEY=cle-initiale\n')
    const id = created()
    writeFileSync(path.join(inst.work, '.env'), 'SECRETS_ENCRYPTION_KEY=autre-cle\n')
    const before = inst.calls().length
    const r = snap(['restore', id])
    expect(r.status).toBe(32)
    expect(inst.calls().slice(before).some(x => x.includes('RENAME TO'))).toBe(false)
    expect(snap(['restore', id, '--yes']).status).toBe(0)
  })

  it('le manifeste ne contient jamais la clé ni de secret', () => {
    inst = make(); writeFileSync(path.join(inst.work, '.env'), 'SECRETS_ENCRYPTION_KEY=cle-tres-secrete\n')
    const id = created()
    const m = readFileSync(path.join(backups(), id, 'manifest.json'), 'utf8')
    expect(m).not.toContain('cle-tres-secrete')
    expect(m).toMatch(/"secretsKeyFingerprint": "[0-9a-f]{12}"/)
  })

  it('somme altérée ⇒ 21, rien n’est touché', () => {
    inst = make()
    const id = created()
    writeFileSync(path.join(backups(), id, 'database.dump'), 'ALTERE')
    const before = inst.calls().length
    expect(snap(['restore', id, '--yes']).status).toBe(21)
    expect(inst.calls().slice(before).some(x => x.includes('RENAME TO'))).toBe(false)
  })

  it('identifiant invalide ⇒ 31, aucun appel docker', () => {
    inst = make()
    for (const bad of ['../x', ';rm -rf /', '20261003T101500Z-pre-update-9.9.9']) {
      const n = inst.calls().length
      expect(snap(['restore', bad, '--yes']).status).toBe(31)
      expect(inst.calls().length).toBe(n)
    }
  })
})

describe('acra-snapshot list / prune', () => {
  it('list --json publie l’index', () => {
    inst = make()
    const id = created()
    const r = snap(['list', '--json'])
    expect(JSON.parse(r.stdout).snapshots[0].id).toBe(id)
  })

  it('prune garde les N derniers pre-update, le point de current.json et tous les manual', () => {
    inst = make()
    const mk = (id: string, reason: string) => {
      const d = path.join(backups(), id); mkdirSync(d, { recursive: true })
      writeFileSync(path.join(d, 'manifest.json'), `{\n  "schema": 1,\n  "id": "${id}",\n  "reason": "${reason}",\n  "createdAt": "2026-10-0${id[7]}T00:00:00Z",\n  "acra": {\n    "version": "1.0.${id[7]}"\n  }\n}\n`)
    }
    const ids = ['20261001T000000Z-pre-update-1.0.1', '20261002T000000Z-pre-update-1.0.2', '20261003T000000Z-pre-update-1.0.3', '20261004T000000Z-pre-update-1.0.4', '20261005T000000Z-pre-update-1.0.5']
    ids.forEach(i => mk(i, 'pre-update'))
    mk('20260901T000000Z-manual-1.0.0', 'manual')
    mkdirSync(path.join(inst.work, '.acra-update/run'), { recursive: true })
    writeFileSync(path.join(inst.work, '.acra-update/run/current.json'), JSON.stringify({ snapshotId: ids[0] }))
    mkdirSync(path.join(backups(), '20260801T000000Z-pre-update-0.9.0.invalid'))
    expect(snap(['prune', '--keep', '2']).status).toBe(0)
    const left = listDir(backups()).filter(x => !x.startsWith('.'))
    expect(left).toContain(ids[0]); expect(left).toContain(ids[3]); expect(left).toContain(ids[4]); expect(left).toContain('20260901T000000Z-manual-1.0.0')
    expect(left).not.toContain(ids[1]); expect(left).not.toContain(ids[2])
    expect(left.some(x => x.endsWith('.invalid'))).toBe(false)
  })

  it('prune --dry-run ne supprime rien', () => {
    inst = make()
    const id = created()
    mkdirSync(path.join(backups(), '20260801T000000Z-pre-update-0.9.0.invalid'))
    const r = snap(['prune', '--dry-run'])
    expect(r.stdout).toMatch(/dry-run/)
    expect(existsSync(path.join(backups(), '20260801T000000Z-pre-update-0.9.0.invalid'))).toBe(true)
    expect(existsSync(path.join(backups(), id))).toBe(true)
  })
})
