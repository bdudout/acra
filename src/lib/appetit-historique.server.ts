// ─── Instantanés d'appétence — accès serveur ─────────────────────────────────────────────────────────────────────────
import { prisma } from './prisma'
import { loadRasRad } from './ras-rad.server'
import { resumeDepuisRasRad, periodeCourante, type ResumeAppetence } from './appetit-historique'
import { fr } from './i18n/fr'
import type { Prisma } from '@prisma/client'
import { appetenceDisponible } from './org-config'

/**
 * Fige le résumé d'appétence du mois pour l'organisation. `ecraser: false` (cron) n'écrase jamais un instantané déjà pris
 * (manuel ou automatique) ; `true` (action manuelle) le rafraîchit. Renvoie null si aucune source (registre, KRI, maturité) n'est active.
 */
export async function capturerInstantane(orgId: string, o: { now: Date; userId: string | null; ecraser: boolean }): Promise<{ periode: string; cree: boolean } | null> {
  const data = await loadRasRad(orgId, 'fr', fr)
  if (!appetenceDisponible(data.modules)) return null
  const periode = periodeCourante(o.now)
  const resume = resumeDepuisRasRad(data as never) as ResumeAppetence
  const where = { organizationId_periode: { organizationId: orgId, periode } }
  if (!o.ecraser) {
    const existant = await prisma.appetenceSnapshot.findUnique({ where, select: { id: true } })
    if (existant) return { periode, cree: false }
  }
  await prisma.appetenceSnapshot.upsert({
    where,
    create: { organizationId: orgId, periode, resume: resume as unknown as Prisma.InputJsonValue, createdById: o.userId },
    update: { resume: resume as unknown as Prisma.InputJsonValue, createdById: o.userId },
  })
  return { periode, cree: true }
}
