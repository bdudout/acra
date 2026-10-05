// Lot D de docs/specs/stockage-supervision-nettoyage.md : hygiène Docker (journaux bornés, image unique, cibles Makefile).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

const read = (f: string) => readFileSync(path.join(process.cwd(), f), 'utf8')
const parse = (f: string) => yaml.load(read(f).replace(/!reset|!override/g, '')) as { services: Record<string, Record<string, unknown>> }

describe('journaux des conteneurs bornés', () => {
  for (const file of ['docker-compose.yml', 'docker-compose.demo.yml']) {
    it(`${file} : tous les services (hors surcharges) plafonnent leurs journaux`, () => {
      const { services } = parse(file)
      const own = Object.entries(services).filter(([, s]) => file === 'docker-compose.yml' || s.image)
      expect(own.length).toBeGreaterThan(0)
      for (const [name, s] of own) {
        const l = s.logging as { driver?: string; options?: Record<string, string> } | undefined
        expect(l, name).toBeDefined()
        expect(l!.driver).toBe('json-file')
        expect(l!.options).toMatchObject({ 'max-size': '10m', 'max-file': '3' })
      }
    })
  }
})

describe('image applicative unique', () => {
  it('app et migrator partagent le même tag et les mêmes arguments de construction', () => {
    const { services } = parse('docker-compose.yml')
    expect(services.app.image).toBe('acra-app:${ACRA_VERSION:-dev}')
    expect(services.migrator.image).toBe(services.app.image)
    expect(services.migrator.build).toEqual(services.app.build)
  })
})

describe('Makefile', () => {
  const mk = read('Makefile')
  it('build utilise le cache ; rebuild force --no-cache', () => {
    expect(mk).toMatch(/^build:\n\tdocker compose build app migrator\n/m)
    expect(mk).toMatch(/^rebuild:\n\tdocker compose build --no-cache app migrator\n/m)
  })
  it('docker-usage affiche la ventilation', () => {
    expect(mk).toMatch(/^docker-usage:\n\tdocker system df -v/m)
  })
  it('docker-clean confirme, purge images/cache/conteneurs arrêtés et ne touche jamais aux volumes', () => {
    const block = mk.split(/^docker-clean:\n/m)[1]?.split(/^\S/m)[0] ?? ''
    expect(block).toMatch(/read -p/)
    expect(block).toMatch(/docker image prune -f/)
    expect(block).toMatch(/docker builder prune -f --keep-storage 5GB/)
    expect(block).toMatch(/docker compose rm -f/)
    const commands = block.split('\n').filter(l => /^\t(?!@echo)/.test(l)).join('\n')
    expect(commands).not.toMatch(/volume|\s-v\b/)
    expect(mk).toMatch(/\.PHONY:.*docker-clean/)
  })
})

describe('.dockerignore', () => {
  it.each(['rapports/', 'audit-annotations/', 'e2e/', 'e2e-public/', 'fixtures/', 'docs/'])('exclut %s', d => {
    expect(read('.dockerignore').split('\n')).toContain(d)
  })
})
