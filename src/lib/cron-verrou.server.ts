// ─── Bail d'exécution des tâches planifiées (une exécution à la fois par tâche) ──
// Deux planificateurs (boucle shell + workflow GitHub) ou plusieurs instances pouvaient lancer la même
// tâche en parallèle : relances envoyées deux fois, webhooks livrés deux fois, instantanés en double.
// Acquisition ATOMIQUE (INSERT … ON CONFLICT … WHERE échu) ; libération en fin de tâche par jeton ;
// expiration automatique si l'instance s'arrête en cours de route.
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'

/** Durée maximale d'un bail : au-delà, la tâche est réputée interrompue et peut être relancée. */
export const CRON_BAIL_MS = 30 * 60 * 1000

export type ResultatVerrou<T> = { execute: true; resultat: T } | { execute: false; raison: 'deja_en_cours' }

/** Exécute `fn` si aucune autre exécution de `tache` n'est en cours ; sinon l'ignore. */
export async function avecVerrouCron<T>(tache: string, fn: () => Promise<T>, bailMs = CRON_BAIL_MS): Promise<ResultatVerrou<T>> {
  const jeton = randomUUID()
  // Colonne `timestamp` sans fuseau, écrite en UTC par Prisma : comparaisons et échéance en UTC,
  // quel que soit le fuseau de la session PostgreSQL.
  const acquis = await prisma.$queryRaw<{ tache: string }[]>`
    INSERT INTO "CronVerrou" ("tache", "jusqua", "jeton")
    VALUES (${tache}, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${bailMs / 1000}), ${jeton})
    ON CONFLICT ("tache") DO UPDATE SET "jusqua" = EXCLUDED."jusqua", "jeton" = EXCLUDED."jeton"
    WHERE "CronVerrou"."jusqua" < (now() AT TIME ZONE 'UTC')
    RETURNING "tache"`
  if (acquis.length === 0) return { execute: false, raison: 'deja_en_cours' }
  try {
    return { execute: true, resultat: await fn() }
  } finally {
    await prisma.cronVerrou.updateMany({ where: { tache, jeton }, data: { jusqua: new Date(0) } }).catch(() => undefined)
  }
}
