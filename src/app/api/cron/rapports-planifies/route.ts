import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { assertCronAuth } from '@/lib/cron-auth'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { rapportsDisponibles } from '@/lib/rapport-model'
import { editionsAPlanifier, sanitizeRapportsConfig } from '@/lib/rapport-masquage'
import { genererContenuRapport } from '@/lib/rapports.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/rapports-planifies — génère, les 1er–3 du mois, le BROUILLON des rapports planifiés
 * par l'ADMIN (`rapportsConfig.planifies`) pour la période précédente. Le brouillon suit ensuite le
 * cycle habituel (relecture, validation quatre-yeux). Idempotent : une édition existante bloque.
 * Créateur = un ADMIN actif de l'organisation. 503 sans CRON_SECRET ; 401 si secret invalide.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied
  const now = new Date()

  const rows = await prisma.organizationConfig.findMany({ select: { id: true, rapportsConfig: true }, take: 5000 })
  let created = 0, orgs = 0
  for (const row of rows) {
    const { planifies } = sanitizeRapportsConfig(row.rapportsConfig)
    if (!planifies.length) continue
    orgs++
    const cfg = await getOrgConfig(row.id)
    const dispo = new Set(rapportsDisponibles(cfg).map(r => r.code))
    const existantes = (await prisma.rapportEdition.findMany({ where: { organizationId: row.id, code: { in: planifies.map(p => p.code) } }, select: { code: true, periodeDebut: true, periodeFin: true }, take: 2000 }))
      .map(e => ({ code: e.code, debut: e.periodeDebut.toISOString().slice(0, 10), fin: e.periodeFin.toISOString().slice(0, 10) }))
    const aFaire = editionsAPlanifier(planifies, existantes, now).filter(x => dispo.has(x.code))
    if (!aFaire.length) continue
    const admin = await prisma.orgMembership.findFirst({ where: { organizationId: row.id, role: 'ADMIN', user: { isActive: true } }, select: { userId: true } })
    if (!admin) continue
    for (const x of aFaire) {
      const contenu = await genererContenuRapport(x.code, row.id, cfg, x.periode, 'fr', now)
      await prisma.rapportEdition.create({
        data: {
          organizationId: row.id, code: x.code, langue: 'fr', statut: 'BROUILLON', createdById: admin.userId,
          periodeDebut: new Date(`${x.periode.debut}T00:00:00Z`), periodeFin: new Date(`${x.periode.fin}T00:00:00Z`),
          contenu: contenu as unknown as Prisma.InputJsonValue,
        },
      })
      created++
    }
  }
  return NextResponse.json({ ok: true, orgs, created })
}
