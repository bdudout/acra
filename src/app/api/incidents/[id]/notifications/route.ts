import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { type UserRole } from '@/lib/permissions'
import { peutQualifier, loadIncidentInScope } from '@/lib/incident-access.server'
import { resolveIncidentsConfig } from '@/lib/incidents-config'
import { marquerSoumis, retirerSoumission, sanitizeNotifications } from '@/lib/notification-regimes'
import { auditLog, getClientIp } from '@/lib/logger'
import { type SessionUser } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'

export const dynamic = 'force-dynamic'

// Suivi des notifications réglementaires / contractuelles d'un incident : l'outil AIDE
// À SUIVRE les délais ; c'est l'entité qui soumet à l'autorité. Réservé à la 2ᵉ ligne.
// Rôle effectif résolu par loadIncidentInScope (organisation active) → `org: 'none'`.
async function garde(req: NextRequest, user: SessionUser, id: string) {
  const c = await loadIncidentInScope({ user: { id: user.id, role: user.role } }, id)
  if ('error' in c) return c.error as NextResponse
  if (!peutQualifier(c.userRole as UserRole, c.secondeLigneActive)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const regime = typeof body.regime === 'string' ? body.regime : ''
  const phase = typeof body.phase === 'string' ? body.phase : ''
  const regimes = resolveIncidentsConfig(c.incidentsConfig).regimes
  if (!regimes.find(r => r.code === regime)?.phases.some(p => p.code === phase)) return NextResponse.json({ error: 'regime_invalide' }, { status: 400 })
  return { c, id, body, regime, phase }
}

async function enregistrer(req: NextRequest, id: string, c: { userId: string; userRole: unknown; incident: { organizationId: string } }, notifications: unknown, action: string, regime: string, phase: string) {
  const updated = await prisma.incident.update({ where: { id }, data: { notifications: notifications as unknown as Prisma.InputJsonValue }, select: { notifications: true } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole as string, organizationId: c.incident.organizationId, ip: getClientIp(req),
    details: { scope: 'incident', action: `notification:${action}`, id, regime, phase },
  })
  return NextResponse.json({ notifications: updated.notifications })
}

// POST /api/incidents/[id]/notifications — marquer une phase comme soumise.
const ACCES = { org: 'none', rateLimit: { bucket: 'incident-notifications' } } as const

export const POST = withAccess(ACCES, async (req, { user, params }) => {
  const g = await garde(req, user, params.id)
  if (!('regime' in g)) return g
  const { c, id, body, regime, phase } = g
  let soumisLe = new Date()
  if (body.soumisLe != null && body.soumisLe !== '') {
    soumisLe = new Date(body.soumisLe)
    if (Number.isNaN(soumisLe.getTime())) return NextResponse.json({ error: 'date_invalide' }, { status: 400 })
  }
  const reference = typeof body.reference === 'string' ? body.reference : undefined
  const liste = marquerSoumis(sanitizeNotifications(c.incident.notifications), { regime, phase, soumisLe, reference })
  return enregistrer(req, id, c, liste, 'soumis', regime, phase)
})

// DELETE /api/incidents/[id]/notifications — annuler la soumission d'une phase (erreur de saisie).
export const DELETE = withAccess(ACCES, async (req, { user, params }) => {
  const g = await garde(req, user, params.id)
  if (!('regime' in g)) return g
  const { c, id, regime, phase } = g
  const liste = retirerSoumission(sanitizeNotifications(c.incident.notifications), regime, phase)
  return enregistrer(req, id, c, liste, 'retire', regime, phase)
})
