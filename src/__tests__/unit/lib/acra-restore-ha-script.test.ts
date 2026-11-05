// Profil « ha » : scripts/acra-restore-ha.sh — restauration d'un dump logique dans une base NEUVE (garde-fous + contrôles)
// et copie des documents S3 à un instant donné (versioning, rclone simulé). Docker/psql simulés (update-fixture).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { makeInstance, type Instance } from '../../helpers/update-fixture'

// Hôte d'une URL PostgreSQL dans une ligne de commande (« @hote: »), sans recherche de sous-chaîne d'URL.
const viseHote = (cmd: string, hote: string) => cmd.includes('@' + hote + ':')

vi.setConfig({ testTimeout: 90_000 })
let inst: Instance
afterEach(() => inst?.cleanup())
const make = () => makeInstance({ scripts: ['update.sh', 'acra-snapshot.sh', 'acra-restore-ha.sh'] })
const HA = { ACRA_DEPLOY_PROFILE: 'ha', DATABASE_URL: 'postgresql://app:secret-pw@pg.example.org:5432/appdb', ACRA_PG_CLIENT: 'docker' }
const TARGET = 'postgresql://app:secret-pw@pg-new.example.org:5432/acra_restored'
const point = () => { const r = inst.run('scripts/acra-snapshot.sh', ['create', '--reason', 'manual', '--from-version', '1.0.4'], HA); expect(r.status, r.stderr).toBe(0); return r.stdout.trim() }
const restore = (args: string[], env: Record<string, string> = {}) => inst.run('scripts/acra-restore-ha.sh', args, { ...HA, ...env })

describe('acra-restore-ha database', () => {
  it('restaure dans une base neuve en une transaction, puis contrôle comptes et empreinte des documents', () => {
    inst = make(); const id = point()
    const before = inst.calls().length
    const r = restore(['database', id, '--target-url', TARGET, '--yes'])
    expect(r.status, r.stderr).toBe(0)
    const c = inst.calls().slice(before)
    expect(c.some(x => x.includes('pg_restore -d') && x.includes('pg-new.example.org:5432/acra_restored') && x.includes('--single-transaction') && x.includes('--exit-on-error'))).toBe(true)
    expect(c.some(x => x.includes('--clean'))).toBe(false)
    expect(c.some(x => x.includes('count(*) FROM "User"') && x.includes('acra_restored'))).toBe(true)
    expect(c.some(x => x.includes('storageKey') && x.includes('acra_restored'))).toBe(true)
    expect(c.some(x => viseHote(x, 'pg.example.org'))).toBe(false)
    expect(r.stdout).toMatch(/restaurée et contrôlée/); expect(r.stdout + r.stderr).not.toContain('secret-pw')
  })

  it('refuse une base cible non vide (34) ; --force la remplace (--clean)', () => {
    inst = make(); const id = point(); inst.fakeFile('target_tables', '7')
    const before = inst.calls().length
    expect(restore(['database', id, '--target-url', TARGET, '--yes']).status).toBe(34)
    expect(inst.calls().slice(before).some(x => x.includes('pg_restore -d'))).toBe(false)
    const r = restore(['database', id, '--target-url', TARGET, '--yes', '--force'])
    expect(r.status, r.stderr).toBe(0)
    expect(inst.calls().some(x => x.includes('pg_restore -d') && x.includes('--clean') && x.includes('--if-exists'))).toBe(true)
  })

  it('refuse TOUJOURS la base de production (35), même avec --force et même écrite autrement', () => {
    inst = make(); const id = point()
    const before = inst.calls().length
    for (const t of ['postgresql://other:x@PG.example.org/appdb', 'postgresql://app:secret-pw@pg.example.org:5432/appdb?sslmode=require']) {
      expect(restore(['database', id, '--target-url', t, '--yes', '--force']).status).toBe(35)
    }
    expect(restore(['database', id, '--target-url', 'postgresql://x@pg-direct.example.org:5000/appdb', '--yes'], { BACKUP_DATABASE_URL: 'postgresql://ro@pg-direct.example.org:5000/appdb' }).status).toBe(35)
    // Connexion directe au primaire des migrations (Patroni : port d'écriture HAProxy) : c'est aussi la production.
    expect(restore(['database', id, '--target-url', 'postgresql://x@pg-primaire.example.org:5432/appdb', '--yes', '--force'], { MIGRATION_DATABASE_URL: 'postgresql://mig:pw@pg-primaire.example.org/appdb' }).status).toBe(35)
    expect(inst.calls().length).toBe(before)
  })

  it('contrôle en échec (comptes ou empreinte des documents) ⇒ 30 et consigne de ne pas basculer', () => {
    inst = make(); const id = point()
    inst.fakeFile('rows_User', '999')
    const r = restore(['database', id, '--target-url', TARGET, '--yes'])
    expect(r.status).toBe(30); expect(r.stderr).toMatch(/NE PAS basculer/)
    inst.cleanup(); inst = make(); const id2 = point()
    inst.fakeFile('keys', 'org1/doc1/a.pdf\n')
    expect(restore(['database', id2, '--target-url', TARGET, '--yes']).status).toBe(30)
  })

  it('point corrompu (21), inconnu ou invalide (31), confirmation erronée (2), URL invalide (2)', () => {
    inst = make(); const id = point()
    writeFileSync(path.join(inst.work, 'backups', id, 'database.dump'), 'ALTERE')
    expect(restore(['database', id, '--target-url', TARGET, '--yes']).status).toBe(21)
    expect(restore(['database', '../x', '--target-url', TARGET, '--yes']).status).toBe(31)
    expect(restore(['database', '20250101T000000Z-manual-9', '--target-url', TARGET, '--yes']).status).toBe(31)
    inst.cleanup(); inst = make(); const id2 = point()
    expect(restore(['database', id2, '--target-url', 'mysql://x/y', '--yes']).status).toBe(2)
    expect(restore(['database', id2, '--target-url', TARGET]).status).toBe(2) // pas de saisie (stdin vide) ⇒ annulé
  })
})

describe('acra-restore-ha documents', () => {
  const S3 = { S3_ENDPOINT: 'https://s3.example.org', S3_REGION: 'gra', S3_BUCKET: 'acra-docs', S3_ACCESS_KEY_ID: 'AKID', S3_SECRET_ACCESS_KEY: 's3-secret', S3_PREFIX: 'prod' }
  const fakeRclone = () => { const p = path.join(inst.root, 'rclone'); writeFileSync(p, '#!/bin/sh\necho "RCLONE $* KEY=$RCLONE_CONFIG_ACRADOCS_ACCESS_KEY_ID" >> "$AUDIT_LOG"\n[ -e "$FAKE_DIR/rclone_fail" ] && exit 1\nexit 0\n', { mode: 0o755 }); return p }

  it('copie l’état du bucket à l’instant donné vers un autre bucket (version_at), puis contrôle ; identifiants hors arguments', () => {
    inst = make(); const rc = fakeRclone()
    const r = restore(['documents', '--at', '2026-10-16T02:00:00Z', '--to-bucket', 'acra-docs-restore'], { ...S3, ACRA_RCLONE: rc })
    expect(r.status, r.stderr).toBe(0)
    const c = inst.calls().filter(x => x.startsWith('RCLONE'))
    expect(c[0]).toMatch(/^RCLONE copy ACRADOCS,version_at=2026-10-16T02:00:00Z:acra-docs\/prod ACRADOCS:acra-docs-restore --checksum KEY=AKID$/)
    expect(c[1]).toMatch(/^RCLONE check ACRADOCS,version_at=2026-10-16T02:00:00Z:acra-docs\/prod ACRADOCS:acra-docs-restore --one-way/)
    expect(c.join('\n')).not.toContain('s3-secret')
  })

  it('limité aux clés référencées par un point (--keys-from)', () => {
    inst = make(); const id = point(); const rc = fakeRclone()
    const r = restore(['documents', '--at', '2026-10-16T02:00:00Z', '--to-bucket', 'acra-docs-restore', '--keys-from', id], { ...S3, ACRA_RCLONE: rc })
    expect(r.status, r.stderr).toBe(0)
    expect(inst.calls().filter(x => x.startsWith('RCLONE copy'))[0]).toContain('--files-from-raw')
  })

  it('refuse la restauration en place, une date invalide, sans destination ; échec de rclone ⇒ 30', () => {
    inst = make(); const rc = fakeRclone(); const env = { ...S3, ACRA_RCLONE: rc }
    expect(restore(['documents', '--at', '2026-10-16T02:00:00Z', '--to-bucket', 'acra-docs', '--to-prefix', 'prod'], env).status).toBe(2)
    expect(restore(['documents', '--at', 'hier', '--to-bucket', 'x-restore'], env).status).toBe(2)
    expect(restore(['documents', '--at', '2026-10-16T02:00:00Z'], env).status).toBe(2)
    mkdirSync(path.join(inst.root, 'out'))
    inst.fakeFile('rclone_fail')
    expect(restore(['documents', '--at', '2026-10-16T02:00:00Z', '--to-dir', path.join(inst.root, 'out')], env).status).toBe(30)
  })
})
