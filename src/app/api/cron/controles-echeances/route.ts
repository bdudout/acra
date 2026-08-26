import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { prochaineEcheance, etatEcheance, type Periodicite } from '@/lib/controle'
import { sendEmail } from '@/lib/email'
import { controleEcheanceEmail } from '@/lib/email-i18n'

export const dynamic = 'force-dynamic'

const RECIPIENT_ROLES = ['RSSI', 'ADMIN', 'RISK_MANAGER'] as const

/**
 * POST /api/cron/controles-echeances — RAPPEL des contrôles à exécuter.
 *
 * À appeler par un planificateur externe avec `Authorization: Bearer <CRON_SECRET>`.
 * Pour chaque contrôle ACTIF dont l'échéance est atteinte (DU) ou dépassée
 * (EN_RETARD) et qui n'a pas déjà été signalé, notifie la gouvernance de
 * l'organisation, puis marque `alerteeLe` (anti-doublon). Le marquage est remis
 * à null dès qu'une exécution est enregistrée → une alerte par période.
 *
 * 503 si CRON_SECRET absent ; 401 si le secret ne correspond pas.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied

  const now = new Date()
  const candidats = await prisma.controle.findMany({
    where: { actif: true, alerteeLe: null },
    select: {
      id: true, organizationId: true, intitule: true, periodicite: true, createdAt: true, responsable: true,
      executions: { orderBy: { dateRealisation: 'desc' }, take: 1, select: { dateRealisation: true } },
    },
  })

  // Le module peut être inactif sur certaines organisations : on ne notifie pas.
  const actifCache = new Map<string, boolean>()
  const moduleActif = async (orgId: string): Promise<boolean> => {
    if (!actifCache.has(orgId)) actifCache.set(orgId, (await getOrgConfig(orgId)).controlePermanentActive)
    return actifCache.get(orgId)!
  }

  type Recipient = { email: string; locale: string | null }
  const destCache = new Map<string, Recipient[]>()
  const destinatairesFor = async (orgId: string): Promise<Recipient[]> => {
    if (!destCache.has(orgId)) {
      const rows = await prisma.orgMembership.findMany({
        where: { organizationId: orgId, role: { in: [...RECIPIENT_ROLES] } },
        select: { user: { select: { email: true, isActive: true, locale: true } } },
      })
      const byEmail = new Map<string, Recipient>()
      for (const r of rows) {
        if (r.user.isActive && r.user.email && !byEmail.has(r.user.email)) {
          byEmail.set(r.user.email, { email: r.user.email, locale: r.user.locale })
        }
      }
      destCache.set(orgId, [...byEmail.values()])
    }
    return destCache.get(orgId)!
  }

  let alerted = 0, emailsSent = 0, emailsSkipped = 0
  for (const c of candidats) {
    if (!(await moduleActif(c.organizationId))) continue

    const derniere = c.executions[0]?.dateRealisation ?? null
    const echeance = prochaineEcheance(c.periodicite as Periodicite, derniere, c.createdAt)
    const etat = etatEcheance(echeance, now)
    // Rien à signaler tant que l'échéance n'est pas atteinte.
    if (etat === 'A_VENIR') continue

    const jour = echeance.toISOString().slice(0, 10)
    for (const r of await destinatairesFor(c.organizationId)) {
      const { subject, text, html } = controleEcheanceEmail(r.locale, {
        intitule: c.intitule, echeance: jour, enRetard: etat === 'EN_RETARD', responsable: c.responsable,
      })
      const res = await sendEmail({ to: r.email, subject, text, html })
      if (res.ok) emailsSent++; else emailsSkipped++
    }

    await prisma.controle.update({ where: { id: c.id }, data: { alerteeLe: now } })
    alerted++
  }

  return NextResponse.json({ ok: true, checked: candidats.length, alerted, emailsSent, emailsSkipped })
}
