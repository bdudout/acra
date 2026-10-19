// ─── Journal d'exécution des tâches planifiées (intégrité, 16/10/2026) ────────────────────
// Chaque exécution d'une route /api/cron/* est tracée (ExecutionTache) : début, fin, durée, statut,
// erreur, résumé. Un échec — exception ou réponse en erreur — est SIGNALÉ (journal d'audit
// TACHE_PLANIFIEE_ECHEC, transmis au SIEM) et la tâche est relançable depuis l'administration
// (/api/admin/taches). Les tâches sont idempotentes (bail CronVerrou, marqueurs) : une reprise ne crée
// pas de doublon. Rétention : 90 jours.
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/lib/logger'

export type Declencheur = 'CRON' | 'MANUEL'
const RETENTION_MS = 90 * 86_400_000
const MAX_ERREUR = 2000

/** Exécute `fn` en traçant l'exécution ; une exception devient une réponse 500 stable (message interne non divulgué). */
export async function executerTache(tache: string, declencheur: Declencheur, fn: () => Promise<Response>): Promise<Response> {
  const debut = Date.now()
  const exec = await prisma.executionTache.create({ data: { tache, declencheur }, select: { id: true } })
  let reponse: Response
  let erreur: string | null = null
  let resume: unknown = null
  try {
    reponse = await fn()
    resume = await reponse.clone().json().catch(() => null)
    if (!reponse.ok) {
      const code = resume && typeof resume === 'object' && 'error' in resume ? String((resume as { error: unknown }).error) : ''
      erreur = `HTTP ${reponse.status}${code ? ` : ${code}` : ''}`
    }
  } catch (e) {
    erreur = (e instanceof Error ? e.message : String(e)) || 'erreur inconnue'
    reponse = NextResponse.json({ ok: false, error: 'tache_echec', tache }, { status: 500 })
  }
  await prisma.executionTache.update({
    where: { id: exec.id },
    data: {
      statut: erreur ? 'ECHEC' : 'OK', fin: new Date(), dureeMs: Date.now() - debut,
      erreur: erreur?.slice(0, MAX_ERREUR) ?? null,
      resume: resume && typeof resume === 'object' ? (resume as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  }).catch(() => undefined)
  if (erreur) {
    try { await auditLog('TACHE_PLANIFIEE_ECHEC', { targetType: 'tache', targetId: tache, details: { tache, declencheur, erreur: erreur.slice(0, 500) } }) } catch { /* le journal ne bloque pas */ }
  }
  await prisma.executionTache.deleteMany({ where: { tache, debut: { lt: new Date(Date.now() - RETENTION_MS) } } }).catch(() => undefined)
  return reponse
}
