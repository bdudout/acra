import { NextResponse } from 'next/server'
import { accesResultats } from '@/lib/acces-resultats.server'
import { visibiliteMission } from '@/lib/acces-resultats'
import { withAccess } from '@/lib/with-access.server'
import type { SessionUser } from '@/lib/route-guard.server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope, roleSurRessource } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutEcrireAudit, type UserRole } from '@/lib/permissions'
import {
  validateMissionInput, cleanMissionInput, transitionMissionAutorisee,
  synthetiserConstats, constatEnRetard, prochaineFenetreMission,
  type MissionStatut, type MissionRecurrence,
} from '@/lib/audit'
import { sanitizeChampsConfig, fusionnerChamps, valeursVisibles, avecChampsVisibles } from '@/lib/champs-perso'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Mission cherchée dans le périmètre visible, sans organisation active exigée : `org: 'none'`
// et résolution du rôle effectif ici ; 404 avant le contrôle de rôle (ordre conservé).
const ACCESS_ECRITURE = { org: 'none', rateLimit: { bucket: 'audit-missions' } } as const

async function loadInScope(user: SessionUser, id: string) {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const mission = await prisma.auditMission.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true, statut: true, champs: true },
  })
  if (!mission) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  // Rôle EFFECTIF dans l'organisation DE LA RESSOURCE, jamais celui de l'org active (CWE-863).
  const userRole = await roleSurRessource(userId, user.role, mission.organizationId)
  const cfg = await getOrgConfig(mission.organizationId)
  if (!cfg.auditInterneActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { userId, userRole, mission, champsPersonnalises: cfg.champsPersonnalises }
}

// GET /api/audit/missions/[id] — détail + constats (avec « en retard » calculé).
export const GET = withAccess({ org: 'none' }, async (_req, { user, params: { id } }) => {
  const c = await loadInScope(user, id)
  if (c.error) return c.error

  const mission = await prisma.auditMission.findUnique({
    where: { id },
    include: {
      constats: {
        orderBy: [{ criticite: 'desc' }, { createdAt: 'asc' }],
        include: { riskItem: { select: { intitule: true } } },
      },
    },
  })
  if (!mission) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  // Résultats réservés aux interlocuteurs concernés (lib/acces-resultats) : sinon introuvable, ou ses seuls constats.
  const vue = visibiliteMission(mission, mission.constats, await accesResultats(c.userId, c.userRole as UserRole))
  if (!vue.visible) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const now = new Date()
  const { constats: _tous, ...enteteComplet } = mission
  void _tous
  const constats = vue.constats
  const entete = vue.complete ? enteteComplet : { ...enteteComplet, rapports: [] }
  return NextResponse.json({
    mission: { ...entete, champs: valeursVisibles(sanitizeChampsConfig(c.champsPersonnalises).mission ?? [], entete.champs, c.userRole) },
    constats: constats.map(({ riskItem, ...c2 }) => ({
      ...c2,
      champs: valeursVisibles(sanitizeChampsConfig(c.champsPersonnalises).constat ?? [], c2.champs, c.userRole),
      riskIntitule: riskItem?.intitule ?? null,
      enRetard: constatEnRetard(c2, now),
    })),
    synthese: synthetiserConstats(constats, now),
  })
})

// PATCH /api/audit/missions/[id] — éditer ou faire transitionner la mission.
export const PATCH = withAccess(ACCESS_ECRITURE, async (req, { user, params: { id } }) => {
  const c = await loadInScope(user, id)
  if (c.error) return c.error
  if (!peutEcrireAudit(c.userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))

  // Archivage / désarchivage — action dédiée (indépendante des transitions de statut).
  if (typeof body.archive === 'boolean') {
    const updated = await prisma.auditMission.update({
      where: { id }, data: { archiveLe: body.archive ? new Date() : null },
    })
    await auditLog('ORGANIZATION_CONFIG_UPDATED', {
      userId: c.userId, userRole: c.userRole, organizationId: c.mission.organizationId, ip: getClientIp(req),
      details: { scope: 'audit-mission', action: body.archive ? 'archive' : 'unarchive', id },
    })
    return NextResponse.json(avecChampsVisibles(updated, sanitizeChampsConfig(c.champsPersonnalises).mission ?? [], c.userRole))
  }

  const depuis = c.mission.statut as MissionStatut
  const vers = (typeof body.statut === 'string' ? body.statut : depuis) as MissionStatut
  if (!transitionMissionAutorisee(depuis, vers)) {
    return NextResponse.json({ error: 'transition_interdite' }, { status: 400 })
  }
  const erreur = validateMissionInput(body, { partial: true })
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanMissionInput(body)

  const partiel = Object.fromEntries(
    (Object.keys(data) as (keyof typeof data)[]).filter(k => k in body).map(k => [k, data[k]]),
  ) as Partial<typeof data>

  const updated = await prisma.auditMission.update({
    where: { id },
    data: {
      ...partiel,
      ...('programmeResultats' in partiel ? { programmeResultats: partiel.programmeResultats as unknown as object } : {}),
      ...(vers !== depuis ? { statut: vers } : {}),
      ...('champs' in body ? { champs: fusionnerChamps(sanitizeChampsConfig(c.champsPersonnalises).mission ?? [], c.mission.champs, body.champs, c.userRole) as unknown as object } : {}),
    },
  })

  // Plan pluriannuel : à la clôture d'une mission périodique récurrente, planifier
  // automatiquement la suivante (même périmètre/programme, fenêtre décalée).
  let suivanteId: string | null = null
  if (vers === 'CLOTUREE' && depuis !== 'CLOTUREE' && updated.recurrence !== 'NONE') {
    const fenetre = prochaineFenetreMission(updated.recurrence as MissionRecurrence, updated.dateDebut, updated.dateFin)
    if (fenetre) {
      const suivante = await prisma.auditMission.create({
        data: {
          organizationId: c.mission.organizationId, statut: 'PLANIFIEE',
          intitule: updated.intitule, objectif: updated.objectif, perimetre: updated.perimetre,
          responsable: updated.responsable, type: updated.type, recurrence: updated.recurrence,
          dateDebut: fenetre.dateDebut, dateFin: fenetre.dateFin,
          programme: updated.programme as object, processusIds: updated.processusIds as object,
          controleIds: updated.controleIds as object,
        },
      })
      suivanteId = suivante.id
    }
  }

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.mission.organizationId, ip: getClientIp(req),
    details: { scope: 'audit-mission', action: vers !== depuis ? `transition:${depuis}->${vers}` : 'update', id, ...(suivanteId ? { suivanteId } : {}) },
  })
  return NextResponse.json({ ...avecChampsVisibles(updated, sanitizeChampsConfig(c.champsPersonnalises).mission ?? [], c.userRole), suivanteId })
})

// DELETE /api/audit/missions/[id] — supprimer une mission et ses constats.
export const DELETE = withAccess(ACCESS_ECRITURE, async (req, { user, params: { id } }) => {
  const c = await loadInScope(user, id)
  if (c.error) return c.error
  if (!peutEcrireAudit(c.userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  await prisma.auditMission.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.mission.organizationId, ip: getClientIp(req),
    details: { scope: 'audit-mission', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
})
