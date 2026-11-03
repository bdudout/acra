// ─── Journal d'audit infalsifiable : scellement et vérification sur la base (cf. lib/audit-chaine) ───────────────────
// Scellement planifié (tâche « audit-scellement ») : les entrées non scellées plus anciennes que MARGE_MS sont chaînées
// dans l'ordre `seq`, par lots, sous verrou consultatif (une seule chaîne, même en multi-instance). La marge laisse les
// insertions concurrentes se valider avant d'être chaînées. Après chaque scellement, l'ancre (dernier seq + empreinte)
// est écrite dans les journaux techniques (stdout → SIEM) : copie externe qui empêche une réécriture silencieuse.
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { empreinte, verifierSegment, GENESE, type EntreeScellee, type RaisonRupture } from '@/lib/audit-chaine'

export const MARGE_MS = 2 * 60_000
const LOT = 2000
const MAX_PAR_EXECUTION = 50_000
const cle = () => process.env.AUDIT_CHAIN_KEY?.trim() || null
const CHAMPS = { seq: true, createdAt: true, action: true, userId: true, userEmail: true, userRole: true, targetId: true, targetType: true, ip: true, details: true, organizationId: true, hashPrecedent: true, hash: true } as const

/** Scelle les entrées en attente ; renvoie le nombre scellé et l'ancre (dernier seq scellé et son empreinte). */
export async function scellerJournal(now = new Date()): Promise<{ scellees: number; ancre: { seq: string; hash: string } | null }> {
  let total = 0
  let ancre: { seq: string; hash: string } | null = null
  const limite = new Date(now.getTime() - MARGE_MS)
  while (total < MAX_PAR_EXECUTION) {
    const lot = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('acra-audit-chaine'))::text`)
      const dernier = await tx.auditLog.findFirst({ where: { hash: { not: null } }, orderBy: { seq: 'desc' }, select: { seq: true, hash: true } })
      const aSceller = await tx.auditLog.findMany({
        where: { hash: null, createdAt: { lt: limite }, ...(dernier ? { seq: { gt: dernier.seq } } : {}) },
        orderBy: { seq: 'asc' }, take: LOT, select: CHAMPS,
      })
      let prev = dernier?.hash ?? GENESE
      for (const e of aSceller) {
        const h = empreinte(e, prev, cle())
        await tx.auditLog.update({ where: { seq: e.seq }, data: { hashPrecedent: prev, hash: h } })
        prev = h
      }
      const fin = aSceller.at(-1)
      return { n: aSceller.length, ancre: fin ? { seq: fin.seq.toString(), hash: prev } : null }
    }, { timeout: 120_000 })
    total += lot.n
    if (lot.ancre) ancre = lot.ancre
    if (lot.n < LOT) break
  }
  if (ancre) logger.info('AUDIT_ANCRE', { audit: false, seq: ancre.seq, hash: ancre.hash, scellees: total, cle: !!cle() })
  return { scellees: total, ancre }
}

export interface EtatChaine {
  ok: boolean; verifiees: number; nonScellees: number
  /** Entrées non scellées antérieures à la dernière scellée (insérées après coup) : ne peuvent plus entrer dans la chaîne. */
  horsOrdre: number
  rupture: { seq: string; raison: RaisonRupture } | null
  dernier: { seq: string; createdAt: Date } | null
  cleConfiguree: boolean
}

/** Vérifie toute la chaîne (par lots, ordre seq) et compte les entrées non scellées. */
export async function verifierJournal(): Promise<EtatChaine> {
  let prev = GENESE
  let verifiees = 0
  let curseur: bigint | null = null
  let dernier: EtatChaine['dernier'] = null
  for (;;) {
    const lot: EntreeScellee[] = await prisma.auditLog.findMany({
      where: { hash: { not: null }, ...(curseur !== null ? { seq: { gt: curseur } } : {}) }, orderBy: { seq: 'asc' }, take: 5000, select: CHAMPS,
    })
    if (!lot.length) break
    const r = verifierSegment(lot, prev, cle())
    verifiees += r.verifiees
    if (!r.ok) return { ...(await comptes(curseur)), ok: false, verifiees, rupture: r.rupture, dernier, cleConfiguree: !!cle() }
    prev = r.dernierHash
    const fin = lot.at(-1)!
    curseur = fin.seq; dernier = { seq: fin.seq.toString(), createdAt: fin.createdAt }
  }
  return { ...(await comptes(curseur)), ok: true, verifiees, rupture: null, dernier, cleConfiguree: !!cle() }
}

async function comptes(dernierSeq: bigint | null) {
  const [nonScellees, horsOrdre] = await Promise.all([
    prisma.auditLog.count({ where: { hash: null } }),
    dernierSeq !== null ? prisma.auditLog.count({ where: { hash: null, seq: { lt: dernierSeq } } }) : Promise.resolve(0),
  ])
  return { nonScellees, horsOrdre }
}
