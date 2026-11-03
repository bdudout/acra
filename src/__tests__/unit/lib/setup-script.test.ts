// @vitest-environment node
// scripts/setup.sh — génération du .env : clé des Server Functions (toutes installations, jamais régénérée) et profil
// « ha » (multi-instance : secrets, paramètres externes validés AVANT écriture, docker compose config, aucun secret
// affiché). Le script est copié dans un dossier temporaire (il écrit dans <dossier>/.env) ; `docker` est simulé en
// tête du PATH (journal des appels), aucun vrai conteneur.
import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, statSync, readdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'

const SCRIPT = path.join(process.cwd(), 'scripts/setup.sh')

const FAKE_DOCKER = `#!/bin/bash
echo "$*" >> "$AUDIT_LOG"
case "$*" in
  "compose version"*) exit 0 ;;
  compose*" config -q")
    if [ -e "$FAKE_DIR/config_fail" ]; then
      # Une erreur de Compose peut citer une valeur : elle doit être masquée par setup.sh.
      echo "erreur simulée : S3_SECRET_ACCESS_KEY=$(grep '^S3_SECRET_ACCESS_KEY=' .env | cut -d= -f2-)" >&2
      exit 1
    fi ;;
esac
exit 0
`

type Run = { status: number | null; out: string }
let dirs: string[] = []
afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs = [] })

function instance() {
  const root = mkdtempSync(path.join(tmpdir(), 'acra-setup-'))
  dirs.push(root)
  mkdirSync(path.join(root, 'scripts'))
  copyFileSync(SCRIPT, path.join(root, 'scripts/setup.sh'))
  const bin = path.join(root, '.bin'); mkdirSync(bin)
  const fake = path.join(root, '.fake'); mkdirSync(fake)
  writeFileSync(path.join(bin, 'docker'), FAKE_DOCKER, { mode: 0o755 })
  const audit = path.join(root, '.audit.log')
  const envPath = path.join(root, '.env')
  const run = (args: string[], env: Record<string, string> = {}, input = ''): Run => {
    // Environnement minimal : aucune variable ACRA de l'hôte ne doit fuiter dans le test.
    const base: Record<string, string> = { PATH: `${bin}:${process.env.PATH}`, HOME: root, AUDIT_LOG: audit, FAKE_DIR: fake, LANG: 'C.UTF-8' }
    const r = spawnSync('bash', [path.join(root, 'scripts/setup.sh'), ...args], { cwd: root, env: { ...base, ...env } as NodeJS.ProcessEnv, input, encoding: 'utf8', timeout: 30_000 })
    return { status: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') }
  }
  const env = () => readFileSync(envPath, 'utf8')
  const get = (k: string) => { const l = env().split('\n').filter(x => x.startsWith(`${k}=`)); return l.length ? l[l.length - 1].slice(k.length + 1) : undefined }
  const calls = () => (existsSync(audit) ? readFileSync(audit, 'utf8').split('\n').filter(Boolean) : [])
  return { root, fake, envPath, run, env, get, calls, write: (s: string) => writeFileSync(envPath, s, { mode: 0o600 }) }
}

const isAesKey = (k: string | undefined) => {
  if (!k || !/^[A-Za-z0-9+/]+={0,2}$/.test(k) || k.length % 4) return false
  return [16, 24, 32].includes(Buffer.from(k, 'base64').length)
}
const SECRET_KEYS = ['POSTGRES_PASSWORD', 'NEXTAUTH_SECRET', 'SECRETS_ENCRYPTION_KEY', 'CRON_SECRET', 'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY', 'AUDIT_CHAIN_KEY', 'REDIS_PASSWORD', 'S3_SECRET_ACCESS_KEY']
function expectNoSecretIn(out: string, i: ReturnType<typeof instance>) {
  for (const k of SECRET_KEYS) {
    const v = i.get(k)
    if (v) expect(out, `${k} affiché en clair`).not.toContain(v)
  }
}

const KEY_A = Buffer.alloc(32, 1).toString('base64')
const KEY_B = Buffer.alloc(32, 2).toString('base64')
const HA_ENV: Record<string, string> = {
  DOMAIN: 'acra.exemple.fr',
  ACME_EMAIL: 'exploitation@exemple.fr',
  DATABASE_URL: 'postgresql://acra:MotDePasseBase42@pg-rw.interne:5432/acra_rm?sslmode=require',
  S3_ENDPOINT: 'https://s3.gra.io.cloud.ovh.net',
  S3_REGION: 'gra',
  S3_BUCKET: 'acra-documents',
  S3_ACCESS_KEY_ID: 'AKIAEXEMPLE',
  S3_SECRET_ACCESS_KEY: 'SecretS3Exemple/abc+def',
}

describe('setup.sh — syntaxe', () => {
  it('bash -n', () => {
    const r = spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf8' })
    expect(r.status, r.stderr).toBe(0)
  })
})

describe('setup.sh — mono-instance (défaut)', () => {
  it('--auto : .env 600 avec clé des Server Functions valide (32 octets) et aucun secret affiché', () => {
    const i = instance()
    const r = i.run(['--auto'])
    expect(r.status, r.out).toBe(0)
    expect(statSync(i.envPath).mode & 0o777).toBe(0o600)
    expect(isAesKey(i.get('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY'))).toBe(true)
    expect(Buffer.from(i.get('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY')!, 'base64').length).toBe(32)
    expect(i.get('DATABASE_URL')).toMatch(/@db:5432\//)
    expect(i.get('ACRA_DEPLOY_PROFILE')).toBeUndefined()
    expectNoSecretIn(r.out, i)
    expect(i.calls()).toEqual([]) // pas de docker compose en mono-instance (inchangé)
  })

  it('relancé : tous les secrets sont conservés, en particulier la clé (idempotent)', () => {
    const i = instance()
    expect(i.run(['--auto']).status).toBe(0)
    const before = Object.fromEntries(SECRET_KEYS.map(k => [k, i.get(k)]))
    const r = i.run(['--auto'])
    expect(r.status, r.out).toBe(0)
    for (const k of SECRET_KEYS) expect(i.get(k), k).toBe(before[k])
    expect(r.out).toMatch(/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY — valeur conservée/)
  })

  it('installation existante sans clé : la clé est ajoutée, le reste et les variables inconnues sont conservés', () => {
    const i = instance()
    i.write(['POSTGRES_USER=u', 'POSTGRES_PASSWORD=pgsecret123456', 'POSTGRES_DB=d', 'DATABASE_URL=postgresql://u:pgsecret123456@db:5432/d',
      `NEXTAUTH_SECRET=${'n'.repeat(48)}`, 'NEXTAUTH_URL=https://acra.exemple.fr', `SECRETS_ENCRYPTION_KEY=${'s'.repeat(48)}`, `CRON_SECRET=${'c'.repeat(32)}`,
      'SMTP_HOST=smtp.exemple.fr', 'ACRA_DEMO_MODE=false', ''].join('\n'))
    const r = i.run(['--auto'])
    expect(r.status, r.out).toBe(0)
    expect(isAesKey(i.get('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY'))).toBe(true)
    expect(i.get('NEXTAUTH_SECRET')).toBe('n'.repeat(48))
    expect(i.get('NEXTAUTH_URL')).toBe('https://acra.exemple.fr')
    expect(i.get('SMTP_HOST')).toBe('smtp.exemple.fr')
    expect(i.get('ACRA_DEMO_MODE')).toBe('false')
    // Sauvegarde de l'ancien .env, elle aussi en 600
    const backups = readdirSync(i.root).filter(f => f.startsWith('.env.backup.'))
    expect(backups).toHaveLength(1)
    expect(statSync(path.join(i.root, backups[0])).mode & 0o777).toBe(0o600)
  })

  it('--force : régénère les secrets mais JAMAIS la clé des Server Functions ; variables inconnues conservées', () => {
    const i = instance()
    i.write(`NEXTAUTH_SECRET=${'n'.repeat(48)}\nNEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${KEY_A}\nSMTP_HOST=smtp.exemple.fr\n`)
    const r = i.run(['--auto', '--force'])
    expect(r.status, r.out).toBe(0)
    expect(i.get('NEXTAUTH_SECRET')).not.toBe('n'.repeat(48))
    expect(i.get('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY')).toBe(KEY_A)
    expect(i.get('SMTP_HOST')).toBe('smtp.exemple.fr')
  })

  it('clé présente mais invalide : refus (jamais remplacée en silence), .env inchangé', () => {
    const i = instance()
    const before = `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=pas-une-cle\n`
    i.write(before)
    const r = i.run(['--auto'])
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/)
    expect(i.env()).toBe(before)
  })

  it('option inconnue ou profil inconnu : erreur d’usage (2), rien d’écrit', () => {
    const i = instance()
    expect(i.run(['--auto', '--profil', 'cluster']).status).toBe(2)
    expect(i.run(['--auto', '--inconnue']).status).toBe(2)
    expect(existsSync(i.envPath)).toBe(false)
  })
})

describe('setup.sh — clé de chaînage du journal d’audit (AUDIT_CHAIN_KEY)', () => {
  const isKey32 = (k: string | undefined) => isAesKey(k) && Buffer.from(k!, 'base64').length === 32
  it('toute installation (--auto) : générée (base64 de 32 octets, openssl rand -base64 32), jamais affichée', () => {
    const i = instance()
    const r = i.run(['--auto'])
    expect(r.status, r.out).toBe(0)
    expect(isKey32(i.get('AUDIT_CHAIN_KEY'))).toBe(true)
    expect(r.out).not.toContain(i.get('AUDIT_CHAIN_KEY'))
    expect(r.out).toMatch(/AUDIT_CHAIN_KEY — valeur générée/)
    // Distincte des autres clés
    expect(i.get('AUDIT_CHAIN_KEY')).not.toBe(i.get('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY'))
  })
  it('présente : JAMAIS régénérée, ni au relancement ni avec --force', () => {
    const i = instance()
    i.write(`AUDIT_CHAIN_KEY=${KEY_A}\nNEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${KEY_B}\n`)
    expect(i.run(['--auto']).status).toBe(0)
    expect(i.get('AUDIT_CHAIN_KEY')).toBe(KEY_A)
    const r = i.run(['--auto', '--force'])
    expect(r.status, r.out).toBe(0)
    expect(i.get('AUDIT_CHAIN_KEY')).toBe(KEY_A)
    expect(r.out).not.toContain(KEY_A)
  })
  it('installation existante sans clé : ajoutée, avec l’avertissement sur les entrées déjà scellées sans clé', () => {
    const i = instance()
    i.write(`NEXTAUTH_SECRET=${'n'.repeat(48)}\nSMTP_HOST=smtp.exemple.fr\n`)
    const r = i.run(['--auto'])
    expect(r.status, r.out).toBe(0)
    expect(isKey32(i.get('AUDIT_CHAIN_KEY'))).toBe(true)
    expect(r.out).toMatch(/déjà scellées/)
    expect(i.get('SMTP_HOST')).toBe('smtp.exemple.fr')
  })
  it('première installation : pas d’avertissement sur des entrées déjà scellées', () => {
    const i = instance()
    const r = i.run(['--auto'])
    expect(r.status, r.out).toBe(0)
    expect(r.out).not.toMatch(/déjà scellées/)
  })
  it('profil « ha » : générée, ou reprise de l’environnement (hôte supplémentaire) ; différente du .env : refus', () => {
    const i = instance()
    expect(i.run(['--profil', 'ha', '--auto'], { ...HA_ENV, AUDIT_CHAIN_KEY: KEY_A }).status).toBe(0)
    expect(i.get('AUDIT_CHAIN_KEY')).toBe(KEY_A)
    const before = i.env()
    const r = i.run(['--profil', 'ha', '--auto'], { ...HA_ENV, AUDIT_CHAIN_KEY: KEY_B })
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/AUDIT_CHAIN_KEY/)
    expect(r.out).not.toContain(KEY_A); expect(r.out).not.toContain(KEY_B)
    expect(i.env()).toBe(before)
    const j = instance()
    expect(j.run(['--profil', 'ha', '--auto'], HA_ENV).status).toBe(0)
    expect(isKey32(j.get('AUDIT_CHAIN_KEY'))).toBe(true)
  })
})

describe('setup.sh --profil ha — non interactif (variables d’environnement)', () => {
  it('Redis conteneur local : secrets générés, paramètres externes écrits, compose config vérifié, étapes suivantes', () => {
    const i = instance()
    const r = i.run(['--profil', 'ha', '--auto'], HA_ENV)
    expect(r.status, r.out).toBe(0)
    expect(statSync(i.envPath).mode & 0o777).toBe(0o600)
    expect(i.get('ACRA_DEPLOY_PROFILE')).toBe('ha')
    expect(isAesKey(i.get('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY'))).toBe(true)
    expect(i.get('REDIS_PASSWORD')).toMatch(/^[0-9a-f]{64}$/)
    expect(i.get('REDIS_URL')).toBeUndefined() // conteneur local : valeur par défaut de docker-compose.ha.yml
    expect(i.get('DATABASE_URL')).toBe(HA_ENV.DATABASE_URL)
    expect(i.get('NEXTAUTH_URL')).toBe('https://acra.exemple.fr')
    expect(i.get('ACRA_REPLICAS')).toBe('3')
    for (const k of ['DOMAIN', 'ACME_EMAIL', 'S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) expect(i.get(k), k).toBe(HA_ENV[k])
    expect(i.get('S3_FORCE_PATH_STYLE')).toBe('true')
    expect(i.calls()).toContain('compose -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.ha.yml config -q')
    // Jamais un secret en clair (ni le mot de passe de la base, ni la clé S3)
    expectNoSecretIn(r.out, i)
    expect(r.out).not.toContain('MotDePasseBase42')
    // Étapes suivantes : migrations une fois, réplicas, planificateur unique, mise à jour progressive
    expect(r.out).toMatch(/run --rm --no-deps migrator/)
    expect(r.out).toMatch(/up -d/)
    expect(r.out).toMatch(/planificateur/i)
    expect(r.out).toMatch(/update-ha\.sh/)
    expect(r.out).toMatch(/point de défaillance unique/) // Redis conteneur local = essai
  })

  it('relancé : clé et mot de passe Redis conservés ; profil repris du .env sans --profil', () => {
    const i = instance()
    expect(i.run(['--profil', 'ha', '--auto'], HA_ENV).status).toBe(0)
    const key = i.get('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY'); const rp = i.get('REDIS_PASSWORD'); const ns = i.get('NEXTAUTH_SECRET')
    const r = i.run(['--auto', '--sans-verification'])
    expect(r.status, r.out).toBe(0)
    expect(i.get('ACRA_DEPLOY_PROFILE')).toBe('ha')
    expect(i.get('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY')).toBe(key)
    expect(i.get('REDIS_PASSWORD')).toBe(rp)
    expect(i.get('NEXTAUTH_SECRET')).toBe(ns)
    expect(i.get('S3_BUCKET')).toBe('acra-documents')
  })

  it('clé fournie par l’environnement (hôte supplémentaire) : reprise ; différente de celle du .env : refus', () => {
    const i = instance()
    expect(i.run(['--profil', 'ha', '--auto', '--sans-verification'], { ...HA_ENV, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: KEY_A }).status).toBe(0)
    expect(i.get('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY')).toBe(KEY_A)
    const before = i.env()
    const r = i.run(['--profil', 'ha', '--auto', '--sans-verification'], { ...HA_ENV, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: KEY_B })
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/)
    expect(r.out).not.toContain(KEY_A)
    expect(r.out).not.toContain(KEY_B)
    expect(i.env()).toBe(before)
  })

  it('variables obligatoires manquantes : toutes listées, aucun .env écrit, docker non appelé', () => {
    const i = instance()
    const r = i.run(['--profil', 'ha', '--auto'], { DOMAIN: 'acra.exemple.fr' })
    expect(r.status).toBe(1)
    for (const k of ['ACME_EMAIL', 'DATABASE_URL', 'S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) expect(r.out, k).toContain(k)
    expect(existsSync(i.envPath)).toBe(false)
    expect(i.calls()).toEqual([])
  })

  it.each([
    ['DATABASE_URL non PostgreSQL', { DATABASE_URL: 'mysql://u:p@h:3306/d' }, /DATABASE_URL/],
    ['DATABASE_URL sur localhost (injoignable depuis un conteneur)', { DATABASE_URL: 'postgresql://u:p@localhost:5432/d' }, /DATABASE_URL/],
    ['DATABASE_URL sur le service local « db » (désactivé en ha)', { DATABASE_URL: 'postgresql://u:p@db:5432/d' }, /DATABASE_URL/],
    ['MIGRATION_DATABASE_URL invalide', { MIGRATION_DATABASE_URL: 'pas-une-url' }, /MIGRATION_DATABASE_URL/],
    ['S3_ENDPOINT avec chemin', { S3_ENDPOINT: 'https://s3.exemple.fr/acra' }, /S3_ENDPOINT/],
    ['S3_BUCKET invalide', { S3_BUCKET: 'Mon_Bucket' }, /S3_BUCKET/],
    ['S3_SSE inconnu', { S3_SSE: 'aws:kms' }, /S3_SSE/],
    ['REDIS_URL et REDIS_SENTINELS exclusifs', { REDIS_URL: 'rediss://:p@redis.exemple.fr:6380', REDIS_SENTINELS: 'r1:26379' }, /exclusifs/],
    ['REDIS_URL non redis://', { REDIS_URL: 'http://redis.exemple.fr' }, /REDIS_URL/],
    ['Sentinel sans nom de primaire', { REDIS_SENTINELS: 'r1:26379,r2:26379', REDIS_PASSWORD: 'p' }, /REDIS_SENTINEL_MASTER/],
    ['NEXTAUTH_URL en HTTP', { NEXTAUTH_URL: 'http://acra.exemple.fr' }, /NEXTAUTH_URL/],
    ['DOMAIN invalide', { DOMAIN: 'acra exemple' }, /DOMAIN/],
    ['ACRA_REPLICAS non entier', { ACRA_REPLICAS: 'trois' }, /ACRA_REPLICAS/],
    ['valeur avec $ (interpolée par Compose)', { S3_SECRET_ACCESS_KEY: 'abc$def' }, /S3_SECRET_ACCESS_KEY/],
  ])('validation avant écriture — %s : refus, .env existant inchangé', (_l, extra, re) => {
    const i = instance()
    const before = `SMTP_HOST=smtp.exemple.fr\n`
    i.write(before)
    const r = i.run(['--profil', 'ha', '--auto'], { ...HA_ENV, ...extra })
    expect(r.status, r.out).toBe(1)
    expect(r.out).toMatch(re)
    expect(i.env()).toBe(before)
    expect(i.calls()).toEqual([])
  })

  it('Redis Sentinel : REDIS_URL écrite VIDE (annule le conteneur local), sentinelles et mot de passe du primaire', () => {
    const i = instance()
    const r = i.run(['--profil', 'ha', '--auto'], { ...HA_ENV, REDIS_SENTINELS: 'r1:26379,r2:26379,r3:26379', REDIS_SENTINEL_MASTER: 'acra', REDIS_PASSWORD: 'MotDePasseRedisPrimaire' })
    expect(r.status, r.out).toBe(0)
    expect(i.env()).toMatch(/^REDIS_URL=$/m)
    expect(i.get('REDIS_SENTINELS')).toBe('r1:26379,r2:26379,r3:26379')
    expect(i.get('REDIS_SENTINEL_MASTER')).toBe('acra')
    expect(i.get('REDIS_PASSWORD')).toBe('MotDePasseRedisPrimaire')
    expect(r.out).not.toContain('MotDePasseRedisPrimaire')
  })

  it('Redis managé : mot de passe repris de REDIS_URL ; contradictoire avec REDIS_PASSWORD : refus', () => {
    const i = instance()
    const r = i.run(['--profil', 'ha', '--auto'], { ...HA_ENV, REDIS_URL: 'rediss://acra:MotDePasseManage@redis.exemple.fr:6380/0' })
    expect(r.status, r.out).toBe(0)
    expect(i.get('REDIS_URL')).toBe('rediss://acra:MotDePasseManage@redis.exemple.fr:6380/0')
    expect(i.get('REDIS_PASSWORD')).toBe('MotDePasseManage')
    expect(r.out).not.toContain('MotDePasseManage')
    const j = instance()
    const r2 = j.run(['--profil', 'ha', '--auto'], { ...HA_ENV, REDIS_URL: 'rediss://:MotDePasseManage@redis.exemple.fr:6380', REDIS_PASSWORD: 'Autre' })
    expect(r2.status).toBe(1)
    expect(r2.out).toMatch(/REDIS_PASSWORD/)
  })

  it('Redis managé : mot de passe encodé %XX dans l’URL → REDIS_PASSWORD décodé (comme l’application)', () => {
    const i = instance()
    const r = i.run(['--profil', 'ha', '--auto'], { ...HA_ENV, REDIS_URL: 'rediss://:Mot%40Passe@redis.exemple.fr:6380' })
    expect(r.status, r.out).toBe(0)
    expect(i.get('REDIS_PASSWORD')).toBe('Mot@Passe')
    expect(r.out).not.toContain('Mot%40Passe')
  })

  it('Redis managé sans mot de passe : refus', () => {
    const i = instance()
    const r = i.run(['--profil', 'ha', '--auto'], { ...HA_ENV, REDIS_URL: 'rediss://redis.exemple.fr:6380' })
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/REDIS_PASSWORD/)
  })

  it('docker compose config en échec : code 3, sortie de Compose affichée SANS secret', () => {
    const i = instance()
    writeFileSync(path.join(i.fake, 'config_fail'), '')
    const r = i.run(['--profil', 'ha', '--auto'], HA_ENV)
    expect(r.status).toBe(3)
    expect(r.out).toMatch(/erreur simulée/)
    expect(r.out).not.toContain(HA_ENV.S3_SECRET_ACCESS_KEY)
  })

  it('--sans-verification : docker non appelé', () => {
    const i = instance()
    const r = i.run(['--profil', 'ha', '--auto', '--sans-verification'], HA_ENV)
    expect(r.status, r.out).toBe(0)
    expect(i.calls()).toEqual([])
  })

  it('--force refusé en profil « ha » (secrets partagés par tous les réplicas)', () => {
    const i = instance()
    const r = i.run(['--profil', 'ha', '--auto', '--force'], HA_ENV)
    expect(r.status).toBe(2)
    expect(existsSync(i.envPath)).toBe(false)
  })

  it('passage d’une installation mono-instance à « ha » : base locale non reprise, secrets conservés', () => {
    const i = instance()
    expect(i.run(['--auto']).status).toBe(0)
    const ns = i.get('NEXTAUTH_SECRET'); const key = i.get('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY')
    const { DATABASE_URL: _d, ...sansBase } = HA_ENV
    const r = i.run(['--profil', 'ha', '--auto'], sansBase)
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/DATABASE_URL/)
    const r2 = i.run(['--profil', 'ha', '--auto'], HA_ENV)
    expect(r2.status, r2.out).toBe(0)
    expect(i.get('NEXTAUTH_SECRET')).toBe(ns)
    expect(i.get('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY')).toBe(key)
    expect(i.get('NEXTAUTH_URL')).toBe('https://acra.exemple.fr')
  })
})

describe('setup.sh --profil ha — interactif', () => {
  it('questions dans l’ordre, saisies secrètes non réaffichées, Redis managé choisi', () => {
    const i = instance()
    const answers = [
      'acra.exemple.fr',          // DOMAIN
      'exploitation@exemple.fr',  // ACME_EMAIL
      '',                         // NEXTAUTH_URL (défaut https://DOMAIN)
      '4',                        // ACRA_REPLICAS
      HA_ENV.DATABASE_URL,        // DATABASE_URL (secret)
      '',                         // MIGRATION_DATABASE_URL (facultatif)
      HA_ENV.S3_ENDPOINT, HA_ENV.S3_REGION, HA_ENV.S3_BUCKET, HA_ENV.S3_ACCESS_KEY_ID,
      HA_ENV.S3_SECRET_ACCESS_KEY, // secret
      'AES256',                   // S3_SSE
      '',                         // S3_PREFIX
      '2',                        // Redis : managé
      'rediss://redis.exemple.fr:6380/0', // REDIS_URL (secret)
      'MotDePasseManage',         // REDIS_PASSWORD (secret)
      '',                         // REDIS_USERNAME
    ].join('\n') + '\n'
    const r = i.run(['--profil', 'ha'], {}, answers)
    expect(r.status, r.out).toBe(0)
    expect(i.get('ACRA_REPLICAS')).toBe('4')
    expect(i.get('NEXTAUTH_URL')).toBe('https://acra.exemple.fr')
    expect(i.get('S3_SSE')).toBe('AES256')
    expect(i.get('REDIS_URL')).toBe('rediss://redis.exemple.fr:6380/0')
    expect(i.get('REDIS_PASSWORD')).toBe('MotDePasseManage')
    expect(i.get('DATABASE_URL')).toBe(HA_ENV.DATABASE_URL)
    expect(r.out).not.toContain('MotDePasseManage')
    expect(r.out).not.toContain('MotDePasseBase42')
    expect(r.out).not.toContain(HA_ENV.S3_SECRET_ACCESS_KEY)
  })
})

describe('docker-compose — clé et Redis externes réellement transmis', () => {
  const read = (f: string) => readFileSync(path.join(process.cwd(), f), 'utf8').split('\n').filter(l => !/^\s*#/.test(l)).join('\n')
  it('mono-instance : clé transmise à `next build` (vide = comportement Next par défaut)', () => {
    expect(read('docker-compose.yml')).toMatch(/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: \$\{NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:-\}/)
  })
  it('clé de chaînage du journal d’audit transmise à l’application (mono-instance, production et ha)', () => {
    const base = read('docker-compose.yml')
    const app = base.slice(base.indexOf('\n  app:'), base.indexOf('\n  scheduler:'))
    expect(app).toMatch(/\n      AUDIT_CHAIN_KEY: \$\{AUDIT_CHAIN_KEY:-\}/)
    const ha = read('docker-compose.ha.yml')
    const haApp = ha.slice(ha.indexOf('\n  app:'), ha.indexOf('\n  redis:'))
    expect(haApp).toMatch(/\n      AUDIT_CHAIN_KEY: \$\{AUDIT_CHAIN_KEY:-\}/)
  })
  it('ha : clé aussi à l’exécution (contrôle de démarrage) ; REDIS_URL surchargeable (managé) ou vide (Sentinel)', () => {
    const c = read('docker-compose.ha.yml')
    const app = c.slice(c.indexOf('\n  app:'), c.indexOf('\n  redis:'))
    expect(app).toMatch(/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: \$\{NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:\?/)
    expect(app).toMatch(/REDIS_URL: \$\{REDIS_URL-redis:\/\/:\$\{REDIS_PASSWORD:\?/)
    for (const v of ['REDIS_SENTINELS', 'REDIS_SENTINEL_MASTER', 'REDIS_SENTINEL_PASSWORD', 'REDIS_USERNAME', 'REDIS_TLS', 'REDIS_PASSWORD']) {
      expect(app, v).toMatch(new RegExp(`\\n      ${v}: \\$\\{${v}`))
    }
  })
})
