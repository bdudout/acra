import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  devDependencies: Record<string, string>
  overrides: Record<string, string>
}

describe('politique de mise à jour des dépendances CI', () => {
  it.each(['vite', 'postcss', 'esbuild'])('lie l’override %s à sa dépendance directe', (name) => {
    expect(packageJson.devDependencies[name]).toBeDefined()
    expect(packageJson.overrides[name]).toBe(`$${name}`)
  })

  it('diffère la montée majeure d’ESLint tant que le plugin React reste incompatible', () => {
    const config = readFileSync('.github/dependabot.yml', 'utf8')
    expect(config).toMatch(/dependency-name:\s*["']?eslint["']?\s*\n\s*update-types:\s*\[["']?version-update:semver-major["']?\]/)
  })

  it('ignore les fixtures locales non versionnées pendant le lint', () => {
    const config = readFileSync('eslint.config.mjs', 'utf8')
    expect(config).toContain("'.local-fixtures/**'")
  })
})
