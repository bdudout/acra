// Lot D de docs/specs/stockage-supervision-nettoyage.md : hygiène Docker (journaux bornés, image unique, cibles Makefile).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
const read = (f: string) => readFileSync(path.join(process.cwd(), f), 'utf8')
/** Services déclarés au premier niveau (2 espaces) sous `services:` : nom → texte du bloc. */
function services(f: string): Record<string, string> {
  const body = read(f).split(/^services:\n/m)[1].split(/^\S/m)[0]
  const out: Record<string, string> = {}
  for (const part of body.split(/^  (?=[a-z_-]+:\s*$)/m)) { const m = part.match(/^([a-z_-]+):/); if (m) out[m[1]] = part }
  return out
}

describe('journaux des conteneurs bornés', () => {
  for (const file of ['docker-compose.yml', 'docker-compose.demo.yml']) {
    it(`${file} : tous les services (hors surcharges) plafonnent leurs journaux`, () => {
      const own = Object.entries(services(file)).filter(([, b]) => file === 'docker-compose.yml' || /^    image:/m.test(b))
      expect(own.length).toBeGreaterThan(0)
      for (const [name, b] of own) expect(b, name).toMatch(/^    logging: \*logging$/m)
      const anchor = read(file).match(/^x-logging: &logging\n(  .*\n)+/m)?.[0] ?? ''
      expect(anchor).toContain('driver: json-file')
      expect(anchor).toContain('max-size: "10m"')
      expect(anchor).toContain('max-file: "3"')
    })
  }
})

describe('image applicative unique', () => {
  it('app et migrator partagent le même tag et la même construction', () => {
    const s = services('docker-compose.yml')
    for (const n of ['app', 'migrator']) {
      expect(s[n], n).toMatch(/^    image: acra-app:\$\{ACRA_VERSION:-dev\}$/m)
      expect(s[n], n).toMatch(/^    build: \*app-build$/m)
    }
    expect(read('docker-compose.yml')).toMatch(/^x-app-build: &app-build\n(  .*\n)+/m)
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
