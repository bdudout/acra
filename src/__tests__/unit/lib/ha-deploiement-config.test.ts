// @vitest-environment node
// Lot H1.4 — coexistence de deux versions pendant une mise à jour progressive (profil « ha ») : garde-fous de configuration.
// Référence : node_modules/next/dist/docs/01-app/02-guides/self-hosting.md (« Server Functions encryption key »,
// « Deployment identifier », « Version Skew ») et 01-app/03-api-reference/05-config/01-next-config-js/deploymentId.md.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const root = process.cwd()
const read = (f: string) => readFileSync(path.join(root, f), 'utf8')
const sansCommentaires = (s: string) => s.split('\n').filter(l => !/^\s*#/.test(l)).join('\n')

describe('Dockerfile — variables lues par `next build`', () => {
  it('clé des Server Functions et identifiant de déploiement déclarés AVANT `npm run build` (étape builder)', () => {
    const d = read('Dockerfile')
    const builder = d.slice(d.indexOf('AS builder'), d.indexOf('AS prisma-cli'))
    const build = builder.indexOf('RUN npm run build')
    expect(build).toBeGreaterThan(0)
    for (const v of ['NEXT_SERVER_ACTIONS_ENCRYPTION_KEY', 'NEXT_DEPLOYMENT_ID']) {
      const at = builder.search(new RegExp(`^ARG ${v}=`, 'm'))
      expect(at, v).toBeGreaterThan(0)
      expect(at, v).toBeLessThan(build)
    }
  })
})

describe('docker-compose.ha.yml', () => {
  const c = sansCommentaires(read('docker-compose.ha.yml'))
  it('mêmes arguments de construction pour app et migrator (une seule image), clé obligatoire, révision comme identifiant', () => {
    expect(c).toMatch(/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: \$\{NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:\?/)
    expect(c).toMatch(/NEXT_DEPLOYMENT_ID: \$\{ACRA_REVISION:-\}/)
    expect(c.match(/args: \*ha-build-args/g)).toHaveLength(2)
  })
  it('profil signalé à l’application et arrêt propre des réplicas', () => {
    expect(c).toMatch(/ACRA_DEPLOY_PROFILE: ha/)
    expect(c).toMatch(/stop_grace_period: 30s/)
  })
})

describe('Caddyfile.ha', () => {
  const c = sansCommentaires(read('Caddyfile.ha'))
  it('affinité par cookie, contrôle de santé actif sur /api/health (drainage = 503)', () => {
    expect(c).toMatch(/lb_policy cookie acra_lb/)
    expect(c).toMatch(/health_uri \/api\/health/)
    expect(c).toMatch(/health_status 200/)
  })
  it('ne surcharge pas Cache-Control (les en-têtes de Next.js font foi)', () => {
    expect(c).not.toMatch(/Cache-Control/i)
  })
})

describe('next.config.js — en-têtes de cache des ressources', () => {
  it('aucune règle ne pose Cache-Control sur /_next/static (Next y met « immutable » seulement si l’en-tête est absent)', async () => {
    const cfg = createRequire(import.meta.url)(path.join(root, 'next.config.js')) as { headers: () => Promise<Array<{ source: string; headers: Array<{ key: string }> }>> }
    const rules = await cfg.headers()
    const touche = (src: string) => src === '/(.*)' || src.startsWith('/_next')
    const fautives = rules.filter(r => touche(r.source) && r.headers.some(h => h.key.toLowerCase() === 'cache-control'))
    expect(fautives).toEqual([])
    expect(rules.some(r => r.source === '/api/(.*)' && r.headers.some(h => h.key === 'Cache-Control'))).toBe(true)
  })
})
