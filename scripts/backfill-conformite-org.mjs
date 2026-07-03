/**
 * Backfill Palier 2 : seed l'entité Conformite (organisation × référentiel) depuis
 * la conformité des analyses SOCLE (isSocle) qui en portent une. Idempotent (upsert).
 * Usage : DATABASE_URL=... node scripts/backfill-conformite-org.mjs
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function sanitize(entries) {
  if (!Array.isArray(entries)) return []
  const ok = new Set(['conforme', 'partiel', 'non_conforme', 'na'])
  const seen = new Set(); const out = []
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue
    const ref = String(e.ref ?? '').trim()
    if (!ref || !ok.has(e.statut) || seen.has(ref)) continue
    seen.add(ref)
    const o = { ref, statut: e.statut }
    if (typeof e.commentaire === 'string' && e.commentaire.trim()) o.commentaire = e.commentaire.trim().slice(0, 1000)
    out.push(o)
  }
  return out
}

const socles = await prisma.analyse.findMany({
  where: { isSocle: true, deletedAt: null, organizationId: { not: null } },
  select: { id: true, nom: true, organizationId: true, referentielMesures: true, cadrage: { select: { socleSecurite: true } } },
})
let created = 0, updated = 0, skipped = 0
for (const s of socles) {
  const entries = sanitize(s.cadrage?.socleSecurite)
  if (entries.length === 0) { skipped++; continue }
  const ref = s.referentielMesures || 'ISO27001'
  const existing = await prisma.conformite.findUnique({ where: { organizationId_referentiel: { organizationId: s.organizationId, referentiel: ref } }, select: { id: true } })
  await prisma.conformite.upsert({
    where: { organizationId_referentiel: { organizationId: s.organizationId, referentiel: ref } },
    create: { organizationId: s.organizationId, referentiel: ref, entries },
    update: { entries },
  })
  if (existing) updated++; else created++
  console.log(`  socle "${s.nom}" org=${s.organizationId} ref=${ref} → ${entries.length} entrées`)
}
console.log(`Backfill terminé : ${created} créées, ${updated} mises à jour, ${skipped} sans conformité.`)
await prisma.$disconnect()
