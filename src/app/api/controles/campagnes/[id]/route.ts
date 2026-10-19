import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole, optionsDefinition } from '@/lib/permissions'
import { peutDefinir } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { validateCampagneControleInput, cleanCampagneControleInput, prochaineFenetreCampagne, type CampagneRecurrence } from '@/lib/campagne-controle'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
const access = { org: 'active', rateLimit: { bucket: 'campagnes-controle' } } as const

/** Module actif, droit de définition (2ᵉ ligne selon l'organisation) et campagne de l'organisation (404 sinon). */
async function guard(userId: string, role: UserRole, orgId: string, id: string) {
  const cfg = await getOrgConfig(orgId)
  if (!cfg.controlePermanentActive) return { error: NextResponse.json({ error: 'module_inactif' }, { status: 403 }) }
  if (!peutDefinir(role, optionsDefinition(cfg))) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  const row = await prisma.campagneControle.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
  if (!row) return { error: NextResponse.json({ error: 'introuvable' }, { status: 404 }) }
  return { error: null, userId, userRole: role, orgId }
}

// PATCH /api/controles/campagnes/[id] — met à jour une campagne (remplacement).
export const PATCH = withAccess(access, async (req, { user, role, orgId, params: { id } }) => {
  const g = await guard(user.id, role, orgId, id)
  if (g.error) return g.error

  const body = await req.json().catch(() => ({}))

  // Archivage / désarchivage — action dédiée (indépendante du remplacement complet).
  if (typeof body.archive === 'boolean') {
    const updated = await prisma.campagneControle.update({ where: { id }, data: { archiveLe: body.archive ? new Date() : null } })
    return NextResponse.json(updated)
  }

  const erreur = validateCampagneControleInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanCampagneControleInput(body)

  // Statut avant mise à jour : on ne planifie la campagne suivante qu'au PASSAGE en clôture.
  const avant = await prisma.campagneControle.findUnique({ where: { id }, select: { statut: true } })

  const updated = await prisma.campagneControle.update({
    where: { id },
    data: {
      intitule: data.intitule, description: data.description, niveau: data.niveau,
      statut: data.statut, recurrence: data.recurrence,
      dateDebut: data.dateDebut, dateFin: data.dateFin, controleIds: data.controleIds,
    },
  })

  // Récurrence : à la clôture d'une campagne récurrente, planifier automatiquement
  // la suivante (même périmètre, fenêtre décalée d'une période) — statut PLANIFIEE.
  let suivanteId: string | null = null
  if (data.statut === 'CLOTUREE' && avant?.statut !== 'CLOTUREE' && data.recurrence !== 'NONE') {
    const fenetre = prochaineFenetreCampagne(data.recurrence as CampagneRecurrence, data.dateDebut, data.dateFin)
    if (fenetre) {
      const suivante = await prisma.campagneControle.create({
        data: {
          organizationId: g.orgId, createdBy: g.userId,
          intitule: data.intitule, description: data.description,
          niveau: data.niveau, statut: 'PLANIFIEE', recurrence: data.recurrence,
          dateDebut: fenetre.dateDebut, dateFin: fenetre.dateFin, controleIds: data.controleIds,
        },
      })
      suivanteId = suivante.id
    }
  }

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: g.userId, userRole: g.userRole, organizationId: g.orgId, ip: getClientIp(req),
    details: { scope: 'campagne-controle', action: 'update', id, ...(suivanteId ? { suivanteId } : {}) },
  })
  return NextResponse.json({ ...updated, suivanteId })
})

// DELETE /api/controles/campagnes/[id]
export const DELETE = withAccess(access, async (req, { user, role, orgId, params: { id } }) => {
  const g = await guard(user.id, role, orgId, id)
  if (g.error) return g.error
  await prisma.campagneControle.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: g.userId, userRole: g.userRole, organizationId: g.orgId, ip: getClientIp(req),
    details: { scope: 'campagne-controle', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
})
