// ─── Rétention du journal d'audit : purge ARCHIVÉE (cf. lib/audit-retention, lib/audit-chaine) ────────────────────────
// Ne purge que des entrées SCELLÉES, en tête de chaîne, plus anciennes que la rétention. Ordre imposé par l'intégrité :
// 1) archive (JSON Lines gzip, entrées complètes avec seq / hashPrecedent / hash) écrite dans le stockage des documents et
//    son empreinte SHA-256 calculée ; 2) dans UNE transaction sous le verrou de la chaîne : suppression (déclencheur levé
//    pour cette seule transaction) + enregistrement de l'ancre `AuditPurge` (dernière empreinte purgée). Échec de
//    l'archivage → rien n'est supprimé. La vérification de la chaîne repart de la dernière ancre.
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getDocumentStorage } from '@/lib/document-storage'
import { dateLimiteRetention } from '@/lib/audit-retention'

const MAX_PAR_PURGE = 100_000

export type ResultatPurge = { purgees: 0; raison: 'retention_non_definie' | 'rien_a_purger' } | { purgees: number; jusquaSeq: string; archiveCle: string; archiveSha256: string }

export async function purgerJournal(now = new Date()): Promise<ResultatPurge> {
  const cfg = await prisma.siemConfig.findUnique({ where: { id: 'global' }, select: { auditRetentionMois: true } })
  if (!cfg?.auditRetentionMois) return { purgees: 0, raison: 'retention_non_definie' }
  const avant = dateLimiteRetention(now, cfg.auditRetentionMois)

  // Préfixe contigu de la chaîne : entrées scellées, antérieures à la limite, jusqu'à la 1ʳᵉ qui ne l'est pas.
  const premiereAGarder = await prisma.auditLog.findFirst({ where: { OR: [{ hash: null }, { createdAt: { gte: avant } }] }, orderBy: { seq: 'asc' }, select: { seq: true } })
  const entrees = await prisma.auditLog.findMany({
    where: { hash: { not: null }, createdAt: { lt: avant }, ...(premiereAGarder ? { seq: { lt: premiereAGarder.seq } } : {}) },
    orderBy: { seq: 'asc' }, take: MAX_PAR_PURGE,
  })
  if (!entrees.length) return { purgees: 0, raison: 'rien_a_purger' }
  const fin = entrees.at(-1)!

  // 1) Archive d'abord (entrées complètes, sérialisation stable ligne à ligne).
  const lignes = entrees.map(e => JSON.stringify({ ...e, seq: e.seq.toString(), createdAt: e.createdAt.toISOString() })).join('\n') + '\n'
  const archive = gzipSync(Buffer.from(lignes, 'utf8'))
  const archiveSha256 = createHash('sha256').update(archive).digest('hex')
  const archiveCle = `audit-archives/journal-${entrees[0].seq}-${fin.seq}-${now.toISOString().slice(0, 10)}.jsonl.gz`
  await (await getDocumentStorage()).put(archiveCle, archive, 'application/gzip')

  // 2) Suppression + ancre, atomiques, sous le verrou de la chaîne (aucun scellement concurrent).
  await prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('acra-audit-chaine'))::text`)
    await tx.$executeRaw`SELECT set_config('acra.audit_purge', 'on', true)`
    const del = await tx.auditLog.deleteMany({ where: { seq: { gte: entrees[0].seq, lte: fin.seq }, hash: { not: null } } })
    if (del.count !== entrees.length) throw new Error('purge_incoherente')
    await tx.auditPurge.create({ data: { jusquaSeq: fin.seq, dernierHash: fin.hash!, nb: del.count, avant, archiveCle, archiveSha256 } })
  }, { timeout: 120_000 })
  return { purgees: entrees.length, jusquaSeq: fin.seq.toString(), archiveCle, archiveSha256 }
}
