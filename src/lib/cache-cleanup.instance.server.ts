// ─── Nettoyage du cache : réglages d'instance et exécution avec le vrai client Prisma ───
import { prisma } from '@/lib/prisma'
import { resolveScaleConfig } from '@/lib/risk-scale'
import { defaultAutoCategories, sanitizeCategories, type CleanupId } from '@/lib/cache-cleanup'
import { previewCleanup, runCleanup, type CleanupDb, type CleanupRunResult } from '@/lib/cache-cleanup.server'

export interface CleanupSettings { autoCleanup: boolean; categories: CleanupId[]; lastCleanupAt: string | null; lastCleanupCounts: Record<string, number> | null }

/** Création du singleton Configuration (instance fraîchement migrée, jamais seedée) : échelles par défaut, comme `demo-server`. */
function baseCreate() {
  const sc = resolveScaleConfig(null)
  return { id: 'global', nbNiveaux: sc.nbNiveaux, echelleGravite: sc.echelleGravite as unknown as object, echelleVraisemblance: sc.echelleVraisemblance as unknown as object, seuilsMatrice: sc.seuilsMatrice as unknown as object, matriceMode: sc.matriceMode }
}

const db = () => prisma as unknown as CleanupDb

export async function getCleanupSettings(): Promise<CleanupSettings> {
  const c = await prisma.configuration.findUnique({ where: { id: 'global' }, select: { autoCleanup: true, cleanupCategories: true, lastCleanupAt: true, lastCleanupCounts: true } })
  const counts = c?.lastCleanupCounts && typeof c.lastCleanupCounts === 'object' && !Array.isArray(c.lastCleanupCounts) ? c.lastCleanupCounts as Record<string, number> : null
  return {
    autoCleanup: c?.autoCleanup ?? true,
    categories: c?.cleanupCategories == null ? defaultAutoCategories() : sanitizeCategories(c.cleanupCategories),
    lastCleanupAt: c?.lastCleanupAt?.toISOString() ?? null,
    lastCleanupCounts: counts,
  }
}

export async function saveCleanupSettings(a: { autoCleanup: boolean; categories: unknown }): Promise<void> {
  const categories = sanitizeCategories(a.categories)
  await prisma.configuration.upsert({ where: { id: 'global' }, create: { ...baseCreate(), autoCleanup: a.autoCleanup, cleanupCategories: categories }, update: { autoCleanup: a.autoCleanup, cleanupCategories: categories } })
}

export const previewInstanceCleanup = (categories: CleanupId[]) => previewCleanup(db(), new Date(), categories)

/** Exécute et mémorise la date + les comptes (jamais de contenu). */
export async function executeInstanceCleanup(categories: CleanupId[]): Promise<CleanupRunResult> {
  await prisma.configuration.upsert({ where: { id: 'global' }, create: baseCreate(), update: {} })
  const now = new Date()
  const r = await runCleanup(db(), now, categories)
  if (r.ok) await prisma.configuration.update({ where: { id: 'global' }, data: { lastCleanupAt: now, lastCleanupCounts: r.counts } })
  return r
}
