// Profil multi-instance « ha » : scripts/acra-snapshot.sh contre une base EXTERNE (DATABASE_URL / BACKUP_DATABASE_URL) et des
// documents en S3 — docs/deploiement-haute-disponibilite.md § 3.4. Docker, psql et l'application sont simulés (update-fixture).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { makeInstance, listDir, type Instance } from '../../helpers/update-fixture'

// Hôte d'une URL PostgreSQL dans une ligne de commande (« @hote: »), sans recherche de sous-chaîne d'URL.
const viseHote = (cmd: string, hote: string) => cmd.includes('@' + hote + ':')

vi.setConfig({ testTimeout: 90_000 })
let inst: Instance
afterEach(() => inst?.cleanup())
const make = () => makeInstance({ scripts: ['update.sh', 'acra-snapshot.sh'] })
const HA = { ACRA_DEPLOY_PROFILE: 'ha', DATABASE_URL: 'postgresql://app:secret-pw@pg.example.org:5432/appdb?sslmode=require', ACRA_PG_CLIENT: 'docker' }
const snap = (args: string[], env: Record<string, string> = {}) => inst.run('scripts/acra-snapshot.sh', args, { ...HA, ...env })
const backups = () => path.join(inst.work, 'backups')
const manifest = (id: string) => JSON.parse(readFileSync(path.join(backups(), id, 'manifest.json'), 'utf8'))
const realPoints = () => listDir(backups()).filter(x => !x.startsWith('.'))
const KEYS = 'org1/doc1/a.pdf\norg1/doc2/b.pdf\n'
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

describe('acra-snapshot — profil ha : sauvegarde logique de la base externe', () => {
  it('dump de DATABASE_URL dans un conteneur client, sans service db local, sans archive de documents ni clone', () => {
    inst = make()
    const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4'])
    expect(r.status, r.stderr).toBe(0)
    const c = inst.calls()
    expect(c.some(x => x.startsWith('run --rm -i --network host postgres:16-alpine pg_dump') && x.includes('pg.example.org:5432/appdb?sslmode=require'))).toBe(true)
    expect(c.some(x => x.includes('ps --status running'))).toBe(false)
    expect(c.some(x => x.includes('run --rm') && x.includes('tar'))).toBe(false)
    expect(c.some(x => x.includes('__snap_'))).toBe(false)
    const id = r.stdout.trim()
    const m = manifest(id)
    expect(m.profile).toBe('ha')
    expect(m.database).toMatchObject({ mode: 'url', name: 'appdb', clone: null })
    expect(m.documents).toMatchObject({ storage: 's3', included: false, referencedKeys: 2, keysSha256: sha(KEYS), keysFile: 'documents-keys.txt', bucketCheck: 'ok' })
    expect(Date.parse(m.documents.keysCapturedAt)).not.toBeNaN()
    expect(readFileSync(path.join(backups(), id, 'documents-keys.txt'), 'utf8')).toBe(KEYS)
    expect(readFileSync(path.join(backups(), id, 'SHA256SUMS'), 'utf8')).toMatch(/ {2}documents-keys\.txt$/m)
    for (const f of readdirSync(path.join(backups(), id))) expect(readFileSync(path.join(backups(), id, f), 'utf8'), f).not.toContain('secret-pw')
    const index = JSON.parse(inst.read('.acra-update/snapshots.json'))
    expect(index.snapshots[0]).toMatchObject({ id, documents: false, documentsStorage: 's3', referencedKeys: 2, bucketCheck: 'ok' })
  })

  it('profil détecté par la surcouche docker-compose.ha.yml de l’agent (ACRA_COMPOSE_FILES)', () => {
    inst = make()
    const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4'], { ACRA_DEPLOY_PROFILE: '', ACRA_COMPOSE_FILES: '-f docker-compose.yml -f docker-compose.production.yml -f docker-compose.ha.yml' })
    expect(r.status, r.stderr).toBe(0)
    expect(manifest(r.stdout.trim()).profile).toBe('ha')
  })

  it('profil lu dans .env (ACRA_DEPLOY_PROFILE=ha écrit par setup.sh) : script lancé à la main sans variable ⇒ restauration refusée (33)', () => {
    inst = make()
    writeFileSync(path.join(inst.work, '.env'), `ACRA_DEPLOY_PROFILE=ha\nDATABASE_URL=${HA.DATABASE_URL}\n`)
    const r = inst.run('scripts/acra-snapshot.sh', ['create', '--reason', 'manual', '--from-version', '1.0.4'], { ACRA_PG_CLIENT: 'docker', ACRA_DEPLOY_PROFILE: '', ACRA_COMPOSE_FILES: '' })
    expect(r.status, r.stderr).toBe(0)
    const id = r.stdout.trim()
    expect(manifest(id).profile).toBe('ha')
    expect(inst.run('scripts/acra-snapshot.sh', ['restore', id, '--yes'], { ACRA_DEPLOY_PROFILE: '', ACRA_COMPOSE_FILES: '' }).status).toBe(33)
  })

  it('BACKUP_DATABASE_URL (connexion directe, hors pgbouncer en mode transaction) est préférée à DATABASE_URL', () => {
    inst = make()
    const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4'], { BACKUP_DATABASE_URL: 'postgresql://ro:pw2@pg-direct.example.org:5000/appdb' })
    expect(r.status, r.stderr).toBe(0)
    const dumps = inst.calls().filter(x => x.includes('pg_dump'))
    expect(dumps.length).toBeGreaterThan(0)
    expect(dumps.every(x => x.includes('pg-direct.example.org:5000/appdb') && !viseHote(x, 'pg.example.org'))).toBe(true)
  })

  it('une sauvegarde déjà en cours sur un autre hôte (bail en base) : code 41, aucun dump', () => {
    inst = make(); inst.fakeFile('lease_held')
    const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4'])
    expect(r.status).toBe(41)
    expect(inst.calls().some(x => x.includes('pg_dump'))).toBe(false)
    expect(realPoints()).toEqual([])
  })

  it('bail pris, libéré en fin de sauvegarde par son jeton', () => {
    inst = make()
    expect(snap(['create', '--reason', 'manual', '--from-version', '1.0.4']).status).toBe(0)
    const c = inst.calls()
    const take = c.findIndex(x => x.includes('CronVerrou') && x.includes('RETURNING') && x.includes('script:sauvegarde-base'))
    const dump = c.findIndex(x => x.includes('pg_dump'))
    const release = c.findIndex(x => x.includes('UPDATE "CronVerrou"') && x.includes('script:sauvegarde-base') && x.includes('1970-01-01'))
    expect(take).toBeGreaterThanOrEqual(0); expect(dump).toBeGreaterThan(take); expect(release).toBeGreaterThan(dump)
  })

  it('point planifié : déjà fait ce jour-là par un autre hôte ⇒ 41 ; sinon fait et marqué', () => {
    inst = make(); inst.fakeFile('lease_marker', 'fait:2026-10-04')
    const sched = ['create', '--reason', 'scheduled', '--tier', 'daily', '--scheduled-for', '2026-10-04', '--from-version', '1.0.4', '--verify', 'quick']
    expect(snap(sched).status).toBe(41)
    expect(inst.calls().some(x => x.includes('pg_dump'))).toBe(false)
    inst.fakeFile('lease_marker', 'fait:2026-10-03')
    const r = snap(sched)
    expect(r.status, r.stderr).toBe(0)
    expect(inst.calls().some(x => x.includes('script:sauvegarde-planifiee') && x.includes('fait:2026-10-04'))).toBe(true)
  })

  it('écart entre la base et le bucket : le point reste valide, l’écart est consigné et signalé', () => {
    inst = make(); inst.fakeFile('bucket_gap')
    const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4'])
    expect(r.status, r.stderr).toBe(0)
    expect(manifest(r.stdout.trim()).documents.bucketCheck).toBe('ecart')
    expect(r.stderr).toMatch(/documents référencés.*absents|écart/i)
  })

  it('application injoignable : contrôle du bucket « non exécuté », sans faire échouer le point', () => {
    inst = make(); inst.fakeFile('no_app')
    const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4'])
    expect(r.status, r.stderr).toBe(0)
    expect(manifest(r.stdout.trim()).documents.bucketCheck).toBe('non_execute')
  })

  it('vérification complète : restauration de contrôle dans une base jetable, clés relues depuis la base restaurée, base supprimée', () => {
    inst = make(); inst.fakeFile('verify_keys', 'org1/doc1/a.pdf\n')
    const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4', '--verify', 'full'])
    expect(r.status, r.stderr).toBe(0)
    const c = inst.calls()
    expect(c.some(x => x.includes('CREATE DATABASE') && x.includes('appdb__verify_'))).toBe(true)
    expect(c.some(x => x.includes('pg_restore -d') && x.includes('appdb__verify_'))).toBe(true)
    expect(c.some(x => x.includes('DROP DATABASE IF EXISTS') && x.includes('appdb__verify_'))).toBe(true)
    const m = manifest(r.stdout.trim())
    expect(m.verification).toMatchObject({ level: 'full', ok: true })
    expect(m.documents).toMatchObject({ referencedKeys: 1, keysSource: 'dump', keysSha256: sha('org1/doc1/a.pdf\n') })
  })

  it('ACRA_BACKUP_VERIFY_DATABASE_URL : la restauration de contrôle a lieu sur ce serveur, pas sur la base de production', () => {
    inst = make()
    const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4', '--verify', 'full'], { ACRA_BACKUP_VERIFY_DATABASE_URL: 'postgresql://v:pw3@verify.example.org:5432/postgres' })
    expect(r.status, r.stderr).toBe(0)
    const c = inst.calls()
    expect(c.some(x => x.includes('CREATE DATABASE') && x.includes('__verify_') && viseHote(x, 'verify.example.org'))).toBe(true)
    expect(c.some(x => x.includes('pg_restore -d') && viseHote(x, 'verify.example.org'))).toBe(true)
    expect(c.some(x => x.includes('__verify_') && viseHote(x, 'pg.example.org'))).toBe(false)
  })

  it('création de la base jetable refusée (droits de l’hébergeur) : point valide, vérification rapide, impossibilité consignée', () => {
    inst = make(); inst.fakeFile('verify_create_fail')
    const r = snap(['create', '--reason', 'manual', '--from-version', '1.0.4', '--verify', 'full'])
    expect(r.status, r.stderr).toBe(0)
    expect(manifest(r.stdout.trim()).verification).toMatchObject({ level: 'quick', ok: true, fullImpossible: true })
    expect(r.stderr).toMatch(/ACRA_BACKUP_VERIFY_DATABASE_URL/)
  })

  it('mono-instance inchangé : création de la base jetable refusée ⇒ point invalide (21)', () => {
    inst = make(); inst.fakeFile('verify_create_fail')
    const r = inst.run('scripts/acra-snapshot.sh', ['create', '--reason', 'pre-update', '--from-version', '1.0.4', '--verify', 'full'])
    expect(r.status, r.stderr).toBe(21)
  })

  it('point avant mise à jour : l’application reste en service (base partagée), connexions actives tolérées', () => {
    inst = make(); inst.fakeFile('activity', '12')
    const r = snap(['create', '--reason', 'pre-update', '--from-version', '1.0.4'])
    expect(r.status, r.stderr).toBe(0)
  })

  it('restauration automatique refusée (33) : base partagée, procédure manuelle exigée — rien n’est renommé ni arrêté', () => {
    inst = make()
    const id = snap(['create', '--reason', 'manual', '--from-version', '1.0.4']).stdout.trim()
    const before = inst.calls().length
    const r = snap(['restore', id, '--yes'])
    expect(r.status).toBe(33)
    expect(r.stderr).toMatch(/acra-restore-ha\.sh/)
    expect(inst.calls().slice(before).some(x => x.includes('RENAME TO') || x.includes(' stop '))).toBe(false)
  })
})
