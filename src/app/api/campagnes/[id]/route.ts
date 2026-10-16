import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import type { SessionUser } from '@/lib/route-guard.server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope, roleSurRessource } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import {
  validateCampagneInput, cleanCampagneInput, transitionCampagneAutorisee,
  avancementCampagne, type CampagneStatut,
} from '@/lib/campagne'
import { auditLog, getClientIp } from '@/lib/logger'
import { campagnesRcsaActives } from '@/lib/org-config'

export const dynamic = 'force-dynamic'

// Campagne cherchée dans le périmètre visible, sans organisation active exigée : `org: 'none'` ;
// le contrôle de rôle dépend de `secondeLigneActive` (config d'org) : il reste dans le handler.
const ACCESS_ECRITURE = { org: 'none', rateLimit: { bucket: 'campagnes' } } as const

function peutPiloter(role: UserRole, secondeLigneActive: boolean): boolean {
  return peutDefinir2eLigne(role, { secondeLigneActive })
}

async function loadInScope(user: SessionUser, id: string) {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const campagne = await prisma.campagne.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true, statut: true },
  })
  if (!campagne) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  // Rôle EFFECTIF dans l'organisation DE LA RESSOURCE, jamais celui de l'org active (CWE-863).
  const userRole = await roleSurRessource(userId, user.role, campagne.organizationId)
  const cfg = await getOrgConfig(campagne.organizationId)
  if (!campagnesRcsaActives(cfg)) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { userId, userRole, campagne, secondeLigneActive: cfg.secondeLigneActive }
}

// GET /api/campagnes/[id] — détail + évaluations (avec le risque rattaché).
export const GET = withAccess({ org: 'none' }, async (_req, { user, params: { id } }) => {
  const c = await loadInScope(user, id)
  if (c.error) return c.error

  const campagne = await prisma.campagne.findUnique({
    where: { id },
    include: {
      evaluations: {
        orderBy: [{ statut: 'asc' }, { createdAt: 'asc' }],
        include: { riskItem: { select: { intitule: true, taxonomieCode: true, proprietaire: true } } },
      },
    },
  })
  if (!campagne) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const { evaluations, ...entete } = campagne
  return NextResponse.json({
    campagne: entete,
    evaluations: evaluations.map(({ riskItem, ...e }) => ({
      ...e,
      riskIntitule: riskItem.intitule,
      riskTaxonomieCode: riskItem.taxonomieCode,
      riskProprietaire: riskItem.proprietaire,
    })),
    avancement: avancementCampagne(evaluations),
  })
})

/**
 * PATCH /api/campagnes/[id] — édition, OUVERTURE ou CLÔTURE (2ᵉ ligne).
 *
 * • OUVERTURE : fige une évaluation par risque du registre (photographie de la
 *   cotation d'origine) — dans une transaction, sinon une campagne ouverte sans
 *   ses évaluations serait inexploitable.
 * • CLÔTURE : exige que TOUTES les évaluations soient validées, puis applique
 *   les cotations validées au registre (c'est l'objet même de la campagne).
 */
export const PATCH = withAccess(ACCESS_ECRITURE, async (req, { user, params: { id } }) => {
  const c = await loadInScope(user, id)
  if (c.error) return c.error
  if (!peutPiloter(c.userRole, c.secondeLigneActive)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const depuis = c.campagne.statut as CampagneStatut
  const vers = (typeof body.statut === 'string' ? body.statut : depuis) as CampagneStatut
  if (!transitionCampagneAutorisee(depuis, vers)) {
    return NextResponse.json({ error: 'transition_interdite' }, { status: 400 })
  }
  const orgId = c.campagne.organizationId
  const now = new Date()

  // ── Ouverture : génère les évaluations ─────────────────────────────────────
  if (vers === 'OUVERTE' && depuis !== 'OUVERTE') {
    const risques = await prisma.riskItem.findMany({
      where: { organizationId: orgId },
      select: {
        id: true, graviteInherente: true, vraisemblanceInherente: true,
        graviteResiduelle: true, vraisemblanceResiduelle: true,
      },
    })
    if (risques.length === 0) return NextResponse.json({ error: 'registre_vide' }, { status: 400 })

    const campagne = await prisma.$transaction(async tx => {
      await tx.campagneEvaluation.createMany({
        data: risques.map(r => ({
          campagneId: id, riskItemId: r.id, organizationId: orgId,
          origineGraviteInherente: r.graviteInherente,
          origineVraisemblanceInherente: r.vraisemblanceInherente,
          origineGraviteResiduelle: r.graviteResiduelle,
          origineVraisemblanceResiduelle: r.vraisemblanceResiduelle,
          // La cotation d'origine sert de point de départ à l'évaluateur.
          graviteInherente: r.graviteInherente,
          vraisemblanceInherente: r.vraisemblanceInherente,
          graviteResiduelle: r.graviteResiduelle,
          vraisemblanceResiduelle: r.vraisemblanceResiduelle,
        })),
        skipDuplicates: true,
      })
      return tx.campagne.update({ where: { id }, data: { statut: 'OUVERTE', ouvertePar: c.userId, ouverteLe: now } })
    })
    await auditLog('ORGANIZATION_CONFIG_UPDATED', {
      userId: c.userId, userRole: c.userRole, organizationId: orgId, ip: getClientIp(req),
      details: { scope: 'campagne', action: 'ouvrir', id, evaluations: risques.length },
    })
    return NextResponse.json(campagne)
  }

  // ── Clôture : applique les cotations validées au registre ──────────────────
  if (vers === 'CLOTUREE' && depuis !== 'CLOTUREE') {
    const evaluations = await prisma.campagneEvaluation.findMany({
      where: { campagneId: id },
      select: {
        id: true, riskItemId: true, statut: true,
        graviteInherente: true, vraisemblanceInherente: true,
        graviteResiduelle: true, vraisemblanceResiduelle: true,
      },
    })
    const avancement = avancementCampagne(evaluations)
    if (!avancement.complete) return NextResponse.json({ error: 'evaluations_incompletes' }, { status: 400 })

    const campagne = await prisma.$transaction(async tx => {
      for (const e of evaluations) {
        await tx.riskItem.update({
          where: { id: e.riskItemId },
          data: {
            graviteInherente: e.graviteInherente,
            vraisemblanceInherente: e.vraisemblanceInherente,
            graviteResiduelle: e.graviteResiduelle,
            vraisemblanceResiduelle: e.vraisemblanceResiduelle,
            statut: 'EVALUE',
          },
        })
      }
      return tx.campagne.update({ where: { id }, data: { statut: 'CLOTUREE', clotureePar: c.userId, clotureeLe: now } })
    })
    await auditLog('ORGANIZATION_CONFIG_UPDATED', {
      userId: c.userId, userRole: c.userRole, organizationId: orgId, ip: getClientIp(req),
      details: { scope: 'campagne', action: 'cloturer', id, risquesMisAJour: evaluations.length },
    })
    return NextResponse.json(campagne)
  }

  // ── Édition simple (entête) ────────────────────────────────────────────────
  const erreur = validateCampagneInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanCampagneInput(body)
  const partiel = Object.fromEntries(
    (Object.keys(data) as (keyof typeof data)[]).filter(k => k in body).map(k => [k, data[k]]),
  ) as Partial<typeof data>
  const updated = await prisma.campagne.update({ where: { id }, data: partiel })
  return NextResponse.json(updated)
})

// DELETE /api/campagnes/[id] — supprimer une campagne NON clôturée (2ᵉ ligne).
export const DELETE = withAccess(ACCESS_ECRITURE, async (req, { user, params: { id } }) => {
  const c = await loadInScope(user, id)
  if (c.error) return c.error
  if (!peutPiloter(c.userRole, c.secondeLigneActive)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  // Une campagne clôturée est une pièce d'archive : elle ne se supprime pas.
  if (c.campagne.statut === 'CLOTUREE') return NextResponse.json({ error: 'campagne_cloturee' }, { status: 400 })

  await prisma.campagne.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.campagne.organizationId, ip: getClientIp(req),
    details: { scope: 'campagne', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
})
