// Migrations Prisma livrées dans l'image (dossiers de `prisma/migrations`), lues une fois puis mises en cache.
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

let cache: string[] | null | undefined
/** Noms de migrations livrées, ou null si le dossier n'existe pas dans cette image. */
export function listShippedMigrations(dir = path.join(process.cwd(), 'prisma', 'migrations')): string[] | null {
  if (cache !== undefined) return cache
  try {
    cache = readdirSync(dir).filter(n => /^\d{14}_/.test(n) && statSync(path.join(dir, n)).isDirectory()).sort()
  } catch { cache = null }
  return cache
}
