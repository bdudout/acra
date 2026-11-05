// @vitest-environment node
// Profil « ha » (ACRA_DEPLOY_PROFILE=ha) : l'application refuse de démarrer sans clé des Server Functions
// valide, sans stockage S3 ou sans store Redis partagé. Le détail des variables S3 et Redis (format, exclusivité,
// joignabilité) reste vérifié par document-storage et shared-store.server (instrumentation.ts) : pas de doublon ici.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { haProfileProblems, isValidServerActionsKey, runStartupChecks } from '@/lib/startup-checks'

// 32 octets encodés en base64 (openssl rand -base64 32)
const KEY32 = Buffer.alloc(32, 7).toString('base64')
const HA_OK = {
  ACRA_DEPLOY_PROFILE: 'ha',
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: KEY32,
  DOCUMENT_STORAGE: 's3',
  REDIS_URL: 'redis://:x@redis:6379/0',
}

describe('isValidServerActionsKey — base64 d’une clé AES de 16, 24 ou 32 octets (self-hosting.md)', () => {
  it.each([16, 24, 32])('%i octets : acceptée', n => {
    expect(isValidServerActionsKey(Buffer.alloc(n, 1).toString('base64'))).toBe(true)
  })
  it.each([
    ['vide', ''],
    ['20 octets', Buffer.alloc(20, 1).toString('base64')],
    ['64 octets', Buffer.alloc(64, 1).toString('base64')],
    ['caractères hors base64', 'abc$def!ghijklmnopqrstuvwxyz0123456789ABCDE='],
    ['base64 tronqué (longueur non multiple de 4)', KEY32.slice(0, -1)],
    ['secret « nettoyé » de setup.sh (sans + / =)', 'Q2hhbmdlTWVQbGVhc2VUaGlzSXNOb3RCYXNlNjQ'],
  ])('%s : refusée', (_l, k) => {
    expect(isValidServerActionsKey(k)).toBe(false)
  })
})

describe('haProfileProblems', () => {
  it('hors profil « ha » : aucune exigence (mono-instance inchangé)', () => {
    expect(haProfileProblems({})).toEqual([])
    expect(haProfileProblems({ ACRA_DEPLOY_PROFILE: 'mono', DOCUMENT_STORAGE: 'local' })).toEqual([])
  })
  it('profil « ha » complet (REDIS_URL ou REDIS_SENTINELS) : aucun problème', () => {
    expect(haProfileProblems(HA_OK)).toEqual([])
    expect(haProfileProblems({ ...HA_OK, REDIS_URL: '', REDIS_SENTINELS: 'r1:26379,r2:26379' })).toEqual([])
    expect(haProfileProblems({ ...HA_OK, DOCUMENT_STORAGE: 'S3' })).toEqual([])
  })
  it('clé des Server Functions absente ou invalide', () => {
    const { NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: _k, ...sans } = HA_OK
    expect(haProfileProblems(sans).join('\n')).toMatch(/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/)
    const p = haProfileProblems({ ...HA_OK, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: 'pas-une-cle' })
    expect(p).toHaveLength(1)
    expect(p[0]).toMatch(/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/)
    // Jamais la valeur elle-même dans le message
    expect(p[0]).not.toContain('pas-une-cle')
  })
  it('stockage des documents autre que s3', () => {
    for (const v of [undefined, '', 'local']) {
      const p = haProfileProblems({ ...HA_OK, DOCUMENT_STORAGE: v })
      expect(p).toHaveLength(1)
      expect(p[0]).toMatch(/DOCUMENT_STORAGE=s3/)
    }
  })
  it('aucun store Redis (ni REDIS_URL ni REDIS_SENTINELS, blancs compris)', () => {
    const p = haProfileProblems({ ...HA_OK, REDIS_URL: '  ', REDIS_SENTINELS: '' })
    expect(p).toHaveLength(1)
    expect(p[0]).toMatch(/REDIS_URL/)
    expect(p[0]).toMatch(/REDIS_SENTINELS/)
  })
  it('tous les manques sont signalés ensemble', () => {
    expect(haProfileProblems({ ACRA_DEPLOY_PROFILE: 'ha' })).toHaveLength(3)
  })
})

describe('runStartupChecks — profil « ha »', () => {
  const BASE = {
    NEXTAUTH_SECRET: 'x'.repeat(48),
    DATABASE_URL: 'postgresql://u:fortmotdepasse@pg:5432/acra',
    NEXTAUTH_URL: 'https://acra.example.fr',
  }
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })
  function run(env: Record<string, string | undefined>) {
    for (const [k, v] of Object.entries({ ACRA_DEPLOY_PROFILE: undefined, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: undefined, DOCUMENT_STORAGE: undefined, REDIS_URL: undefined, REDIS_SENTINELS: undefined, ...BASE, ...env })) {
      vi.stubEnv(k, v as string)
    }
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation((m: unknown) => { errors.push(String(m)) })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    runStartupChecks()
    return { exit, errors: errors.join('\n') }
  }
  it('profil « ha » incomplet : arrêt (code 1), même hors production', () => {
    const { exit, errors } = run({ ACRA_DEPLOY_PROFILE: 'ha' })
    expect(exit).toHaveBeenCalledWith(1)
    expect(errors).toMatch(/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/)
    expect(errors).toMatch(/DOCUMENT_STORAGE=s3/)
  })
  it('profil « ha » complet : démarrage autorisé', () => {
    const { exit } = run(HA_OK)
    expect(exit).not.toHaveBeenCalled()
  })
  it('mono-instance sans clé ni S3 ni Redis : démarrage autorisé (inchangé)', () => {
    const { exit } = run({})
    expect(exit).not.toHaveBeenCalled()
  })
})
