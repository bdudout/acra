import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('Dockerfile — fichiers lus par le processus non privilégié', () => {
  it('attribue les entrées Prisma et les fichiers publics à nextjs', () => {
    const dockerfile = readFileSync(path.join(process.cwd(), 'Dockerfile'), 'utf8')
    for (const source of ['public', 'prisma', 'prisma.config.ts']) {
      expect(dockerfile).toContain(`COPY --from=builder --chown=nextjs:nodejs /app/${source} ./${source}`)
    }
  })
})
