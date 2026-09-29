import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { resolveAuditConfig } from '@/lib/audit-config'
import { calculerRappels } from '@/lib/audit-rappels'
import { sendEmail } from '@/lib/email'
import { auditRappelEmail } from '@/lib/email-i18n'

export const dynamic = 'force-dynamic'

// L'audité est joint via la gouvernance de l'organisation ; l'audit via les rôles d'écriture du module.
const ROLES = { AUDITE: ['RSSI', 'ADMIN', 'RISK_MANAGER'], AUDIT: ['AUDITEUR', 'ADMIN'] } as const

/**
 * POST /api/cron/audit-rappels — RAPPELS des recommandations d'audit (échéance proche, en retard,
 * réalisée à vérifier). Planificateur externe, `Authorization: Bearer <CRON_SECRET>`.
 * Anti-doublon : `AuditConstat.rappelLe`, une relance au plus par `rappelRelanceJours`.
 * Désactivable par organisation (`auditConfig.rappelsActifs`). 503 sans CRON_SECRET ; 401 si secret invalide.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied

  const now = new Date()
  const candidats = await prisma.auditConstat.findMany({
    where: { statut: { in: ['OUVERT', 'EN_COURS', 'RESOLU'] } },
    select: { id: true, organizationId: true, intitule: true, statut: true, echeance: true, rappelLe: true, responsableAction: true, mission: { select: { intitule: true } } },
    take: 10000,
  })

  const cfgCache = new Map<string, { actif: boolean; audit: ReturnType<typeof resolveAuditConfig> }>()
  const cfgOf = async (orgId: string) => {
    if (!cfgCache.has(orgId)) { const c = await getOrgConfig(orgId); cfgCache.set(orgId, { actif: c.auditInterneActive, audit: resolveAuditConfig(c.auditConfig) }) }
    return cfgCache.get(orgId)!
  }
  type Recipient = { email: string; locale: string | null }
  const destCache = new Map<string, Recipient[]>()
  const destinataires = async (orgId: string, cible: keyof typeof ROLES): Promise<Recipient[]> => {
    const k = `${orgId}:${cible}`
    if (!destCache.has(k)) {
      const rows = await prisma.orgMembership.findMany({ where: { organizationId: orgId, role: { in: [...ROLES[cible]] } }, select: { user: { select: { email: true, isActive: true, locale: true } } } })
      const by = new Map<string, Recipient>()
      for (const r of rows) if (r.user.isActive && r.user.email && !by.has(r.user.email)) by.set(r.user.email, { email: r.user.email, locale: r.user.locale })
      destCache.set(k, [...by.values()])
    }
    return destCache.get(k)!
  }

  const parOrg = new Map<string, typeof candidats>()
  for (const c of candidats) parOrg.set(c.organizationId, [...(parOrg.get(c.organizationId) ?? []), c])

  let reminded = 0, emailsSent = 0, emailsSkipped = 0
  for (const [orgId, constats] of parOrg) {
    const { actif, audit } = await cfgOf(orgId)
    if (!actif) continue
    const byId = new Map(constats.map(c => [c.id, c]))
    for (const r of calculerRappels(constats, audit, now)) {
      const c = byId.get(r.constatId)!
      for (const d of await destinataires(orgId, r.destinataire)) {
        const { subject, text, html } = auditRappelEmail(d.locale, { intitule: c.intitule, mission: c.mission.intitule, type: r.type, echeance: c.echeance ? c.echeance.toISOString().slice(0, 10) : null })
        const res = await sendEmail({ to: d.email, subject, text, html })
        if (res.ok) emailsSent++; else emailsSkipped++
      }
      await prisma.auditConstat.update({ where: { id: c.id }, data: { rappelLe: now } })
      reminded++
    }
  }
  return NextResponse.json({ ok: true, checked: candidats.length, reminded, emailsSent, emailsSkipped })
}
