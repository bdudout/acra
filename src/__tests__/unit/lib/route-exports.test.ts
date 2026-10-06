/**
 * Contrat Next.js non vu par tsc : un fichier route.ts / page.tsx / layout.tsx n'exporte que ses handlers et ses options
 * de segment. Toute autre exportation (constante, type, utilitaire) fait échouer `next build` (bloquant de release).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const AUTORISES = /^export (?:default |async function (?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b|function (?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|generateMetadata|generateStaticParams|generateViewport)\b|async function (?:generateMetadata|generateStaticParams|generateViewport)\b|const (?:dynamic|revalidate|runtime|maxDuration|fetchCache|preferredRegion|metadata|viewport|dynamicParams|GET|POST|PUT|PATCH|DELETE)\b)/

const METHODES = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
/** `export { handler as GET }` ou `export { GET } from '…'` : valide si chaque nom exporté est un handler HTTP. */
const reexportHandlers = (l: string) => {
  const m = /^export \{([^}]*)\}/.exec(l)
  return !!m && m[1].split(',').map(x => x.trim().split(/\s+as\s+/).pop()!).filter(Boolean).every(n => METHODES.has(n))
}

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? fichiers(p) : /^(route|page|layout)\.tsx?$/.test(n) ? [p] : []
  })
}

describe('exports des routes et pages Next.js', () => {
  it('aucune exportation hors handlers et options de segment', () => {
    const fautifs = fichiers(join(process.cwd(), 'src/app')).flatMap(f =>
      readFileSync(f, 'utf8').split('\n').map((l, i) => ({ l, i })).filter(({ l }) => /^export /.test(l) && !/^export (?:type|interface) /.test(l) && !AUTORISES.test(l) && !reexportHandlers(l)).map(({ l, i }) => `${f.replace(process.cwd() + '/', '')}:${i + 1} ${l.slice(0, 80)}`))
    expect(fautifs).toEqual([])
  })
})
