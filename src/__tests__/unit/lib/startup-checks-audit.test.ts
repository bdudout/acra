// @vitest-environment node
// Clé de chaînage du journal d'audit (AUDIT_CHAIN_KEY, lib/audit-chaine) : en production, son absence est SIGNALÉE au
// démarrage (avertissement) sans bloquer — sans clé, la chaîne reste vérifiable (SHA-256) mais une personne ayant un accès
// en écriture à la base pourrait la recalculer entièrement. Hors production : silence (développement, tests).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { auditChainKeyWarning } from '@/lib/startup-checks'

describe('auditChainKeyWarning', () => {
  it('production sans clé (absente ou blanche) : avertissement qui nomme la variable et la commande de génération', () => {
    for (const k of [undefined, '', '   ']) {
      const w = auditChainKeyWarning({ NODE_ENV: 'production', AUDIT_CHAIN_KEY: k })
      expect(w).toMatch(/AUDIT_CHAIN_KEY/)
      expect(w).toMatch(/setup\.sh/)
    }
  })
  it('production avec clé : rien', () => {
    expect(auditChainKeyWarning({ NODE_ENV: 'production', AUDIT_CHAIN_KEY: Buffer.alloc(32, 3).toString('base64') })).toBeNull()
  })
  it('hors production : rien, même sans clé', () => {
    expect(auditChainKeyWarning({ NODE_ENV: 'development' })).toBeNull()
    expect(auditChainKeyWarning({})).toBeNull()
  })
  it('le message ne contient jamais la valeur de la clé', () => {
    const cle = 'cle-secrete-tres-reconnaissable'
    expect(auditChainKeyWarning({ NODE_ENV: 'production', AUDIT_CHAIN_KEY: cle }) ?? '').not.toContain(cle)
  })
})

describe('runStartupChecks — clé de chaînage absente en production : avertissement NON bloquant', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules() })
  it('avertit, ne s’arrête pas', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXTAUTH_SECRET', 'x'.repeat(48))
    vi.stubEnv('DATABASE_URL', 'postgresql://u:fortmotdepasse@pg:5432/acra')
    vi.stubEnv('NEXTAUTH_URL', 'https://acra.example.fr')
    vi.stubEnv('SIEM_ALLOWED_HOSTS', 'siem.example.fr')
    vi.stubEnv('ACRA_DEPLOY_PROFILE', '')
    vi.stubEnv('AUDIT_CHAIN_KEY', '')
    vi.resetModules()
    const { runStartupChecks } = await import('@/lib/startup-checks')
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    const warns: string[] = []
    vi.spyOn(console, 'warn').mockImplementation((m: unknown) => { warns.push(String(m)) })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    runStartupChecks()
    expect(exit).not.toHaveBeenCalled()
    expect(warns.join('\n')).toMatch(/AUDIT_CHAIN_KEY/)
  })
})
