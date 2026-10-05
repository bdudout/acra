// Lot 1 de docs/specs/sauvegarde-rollback-spec.md : scripts/acra-snapshot.sh (docker/psql/df simulés).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { statSync, readdirSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { makeInstance, listDir, type Instance } from '../../helpers/update-fixture'

vi.setConfig({ testTimeout: 90_000 })
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

  it('accepte un catalogue pg_restore long et valide sans masquer son code de sortie', () => {
    inst = make(); inst.fakeFile('restore_list_many')
    const r = snap(['create', '--reason', 'pre-update', '--from-version', '1.0.4'])
    expect(r.status, r.stderr).toBe(0)
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

describe('acra-snapshot — mode base externe (lot 6)', () => {
  const url = { ACRA_DB_MODE: 'url', DATABASE_URL: 'postgresql://u:secret-pw@db.example.org:5432/appdb?sslmode=require', ACRA_PG_CLIENT: 'docker' }
  it('url + Docker : outils clients dans postgres:<majeure>-alpine, base issue de DATABASE_URL, mot de passe jamais écrit', () => {
    inst = make()
    const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4'], url)
    expect(r.status, r.stderr).toBe(0)
    const c = inst.calls()
    expect(c.some(x => x.startsWith('run --rm -i --network host postgres:16-alpine') && x.includes('pg_dump') && x.includes('/appdb?sslmode=require'))).toBe(true)
    expect(c.some(x => x.includes('compose') && x.includes('pg_dump'))).toBe(false)
    const id = r.stdout.trim()
    const manifest = readFileSync(path.join(backups(), id, 'manifest.json'), 'utf8')
    expect(manifest).toMatch(/"name": "appdb"/); expect(manifest).toMatch(/"mode": "url"/)
    expect(manifest).not.toContain('secret-pw')
    expect(readFileSync(path.join(backups(), id, 'create.log'), 'utf8')).not.toContain('secret-pw')
  })

  it('sans DATABASE_URL : code 10', () => {
    inst = make()
    expect(snap(['create', '--reason', 'manual', '--from-version', '1.0.4'], { ACRA_DB_MODE: 'url', DATABASE_URL: '' }).status).toBe(10)
  })

  it('hôte sans Docker : client plus ancien que le serveur ⇒ code 10 explicite', () => {
    inst = make()
    const host = path.join(inst.root, 'hostbin'); mkdirSync(host)
    writeFileSync(path.join(host, 'psql'), '#!/bin/sh\necho 160004\n', { mode: 0o755 })
    for (const t of ['pg_dump', 'pg_restore']) writeFileSync(path.join(host, t), '#!/bin/sh\necho "' + t + ' (PostgreSQL) 14.2"\n', { mode: 0o755 })
    const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4'], { ...url, ACRA_PG_CLIENT: 'host', PATH: `${host}:${inst.bin}:/usr/bin:/bin` })
    expect(r.status).toBe(10)
    expect(r.stderr).toMatch(/plus ancien que le serveur/)
    expect(listDir(backups()).filter(x => !x.startsWith('.'))).toEqual([])
  })

  it('crochet ACRA_SNAPSHOT_HOOK appelé avec l’identifiant ; son échec n’est pas bloquant', () => {
    inst = make()
    const hook = path.join(inst.root, 'hook.sh'); writeFileSync(hook, '#!/bin/sh\necho "HOOK $1" >> "$AUDIT_LOG"\nexit 1\n', { mode: 0o755 })
    const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4'], { ACRA_SNAPSHOT_HOOK: hook })
    expect(r.status, r.stderr).toBe(0)
    expect(inst.calls().some(x => x === `HOOK ${r.stdout.trim()}`)).toBe(true)
    expect(r.stderr).toMatch(/Crochet ACRA_SNAPSHOT_HOOK en échec/)
  })
})

describe('points planifiés et rétention grand-père / père / fils', () => {
  it('create --reason scheduled : fréquences et date planifiée au manifeste et à l’index', () => {
    inst = make()
    const r = snap(['create', '--reason', 'scheduled', '--tier', 'daily,weekly', '--scheduled-for', '2026-10-04', '--from-version', '1.0.4', '--no-clone', '--verify', 'quick'])
    expect(r.status, r.stderr).toBe(0)
    const id = r.stdout.trim()
    expect(id).toMatch(/Z-scheduled-1\.0\.4$/)
    const m = JSON.parse(readFileSync(path.join(backups(), id, 'manifest.json'), 'utf8'))
    expect(m).toMatchObject({ reason: 'scheduled', tiers: 'daily,weekly', scheduledFor: '2026-10-04' })
    expect(m.database.clone).toBeNull()
    expect(JSON.parse(inst.read('.acra-update/snapshots.json')).snapshots[0]).toMatchObject({ id, reason: 'scheduled', tiers: ['daily', 'weekly'] })
  })

  it('refuse un point planifié sans fréquence ou sans date valide', () => {
    inst = make()
    expect(snap(['create', '--reason', 'scheduled', '--scheduled-for', '2026-10-04']).status).toBe(2)
    expect(snap(['create', '--reason', 'scheduled', '--tier', 'hourly', '--scheduled-for', '2026-10-04']).status).toBe(2)
    expect(snap(['create', '--reason', 'scheduled', '--tier', 'daily', '--scheduled-for', 'demain']).status).toBe(2)
  })

  const seed = (id: string, tiers: string) => {
    const d = path.join(backups(), id); mkdirSync(d, { recursive: true })
    writeFileSync(path.join(d, 'manifest.json'), `{\n  "schema": 1,\n  "id": "${id}",\n  "reason": "scheduled",\n  "createdAt": "2026-10-01T02:00:00Z",\n  "tiers": "${tiers}",\n  "scheduledFor": "2026-10-01",\n  "acra": {\n    "version": "1.0.4"\n  }\n}\n`)
  }
  const policy = (keep: { daily: number; weekly: number; monthly: number }) => { mkdirSync(path.join(inst.work, '.acra-update'), { recursive: true }); writeFileSync(path.join(inst.work, '.acra-update/backup-policy.json'), `{\n  "schema": 1,\n  "daily": { "enabled": true, "keep": ${keep.daily} },\n  "weekly": { "enabled": true, "keep": ${keep.weekly}, "weekday": 0 },\n  "monthly": { "enabled": true, "keep": ${keep.monthly}, "day": 1 },\n  "hour": 2\n}\n`) }

  it('prune garde pour chaque fréquence ses N copies les plus récentes ; un point partagé compte pour chacune', () => {
    inst = make(); policy({ daily: 2, weekly: 1, monthly: 1 })
    // plus ancien → plus récent
    seed('20260901T020000Z-scheduled-1.0.4', 'monthly')          // 2ᵉ mensuel (hors N=1) ⇒ supprimé
    seed('20260915T020000Z-scheduled-1.0.4', 'weekly')           // 2ᵉ hebdo ⇒ supprimé
    seed('20261001T020000Z-scheduled-1.0.4', 'daily,weekly,monthly') // gardé (mensuel + hebdo)
    seed('20261002T020000Z-scheduled-1.0.4', 'daily')            // 2ᵉ quotidien ⇒ gardé
    seed('20261003T020000Z-scheduled-1.0.4', 'daily')            // 1ᵉʳ quotidien ⇒ gardé
    seed('20260929T020000Z-scheduled-1.0.4', 'daily')            // 3ᵉ quotidien ⇒ supprimé
    expect(snap(['prune']).status).toBe(0)
    const left = listDir(backups()).filter(x => !x.startsWith('.')).sort()
    expect(left).toEqual(['20261001T020000Z-scheduled-1.0.4', '20261002T020000Z-scheduled-1.0.4', '20261003T020000Z-scheduled-1.0.4'])
  })

  it('3 copies par défaut sans fichier de politique ; les points pre-update et manual ne sont pas touchés', () => {
    inst = make()
    for (const d of ['20261001', '20261002', '20261003', '20261004', '20261005']) seed(`${d}T020000Z-scheduled-1.0.4`, 'daily')
    seed('20260801T000000Z-manual-1.0.0', ''); 
    const mid = path.join(backups(), '20260801T000000Z-manual-1.0.0/manifest.json'); writeFileSync(mid, readFileSync(mid, 'utf8').replace('"reason": "scheduled"', '"reason": "manual"'))
    snap(['prune'])
    const left = listDir(backups()).filter(x => !x.startsWith('.')).sort()
    expect(left).toEqual(['20260801T000000Z-manual-1.0.0', '20261003T020000Z-scheduled-1.0.4', '20261004T020000Z-scheduled-1.0.4', '20261005T020000Z-scheduled-1.0.4'])
  })
})

describe('acra-snapshot prune --ids (libération d’espace, liste exacte)', () => {
  const seedPt = (id: string, reason: string) => {
    const d = path.join(backups(), id); mkdirSync(d, { recursive: true })
    writeFileSync(path.join(d, 'manifest.json'), `{\n  "schema": 1,\n  "id": "${id}",\n  "reason": "${reason}",\n  "createdAt": "2026-10-01T02:00:00Z",\n  "acra": {\n    "version": "1.0.4"\n  }\n}\n`)
  }
  const A = '20261001T020000Z-scheduled-1.0.4', B = '20261002T020000Z-scheduled-1.0.4', C = '20261003T020000Z-manual-1.0.4', P = '20261004T020000Z-pre-update-1.0.4'
  const left = () => listDir(backups()).filter(x => !x.startsWith('.')).sort()

  it('ne supprime que les identifiants donnés (y compris un manuel), jamais le point protégé de current.json', () => {
    inst = make(); seedPt(A, 'scheduled'); seedPt(B, 'scheduled'); seedPt(C, 'manual'); seedPt(P, 'pre-update')
    mkdirSync(path.join(inst.work, '.acra-update/run'), { recursive: true })
    writeFileSync(path.join(inst.work, '.acra-update/run/current.json'), JSON.stringify({ snapshotId: P }))
    const r = snap(['prune', '--ids', `${A},${C},${P}`])
    expect(r.status, r.stderr).toBe(0)
    expect(left()).toEqual([B, P])
  })
  it('identifiant invalide : code 31 sans appel docker ni suppression', () => {
    inst = make(); seedPt(A, 'scheduled')
    const before = inst.calls().length
    expect(snap(['prune', '--ids', `${A},../etc`]).status).toBe(31)
    expect(left()).toEqual([A]); expect(inst.calls().length).toBe(before)
  })
  it('identifiant inexistant : ignoré sans erreur', () => {
    inst = make(); seedPt(A, 'scheduled')
    expect(snap(['prune', '--ids', '20250101T000000Z-manual-9']).status).toBe(0)
    expect(left()).toEqual([A])
  })
  it('--dry-run n’efface rien', () => {
    inst = make(); seedPt(A, 'scheduled')
    expect(snap(['prune', '--ids', A, '--dry-run']).stdout).toMatch(/dry-run/)
    expect(left()).toEqual([A])
  })
})
