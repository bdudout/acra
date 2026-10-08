import { risquesDepuisCorps } from '@/lib/incident-risques'
import { instantaneIncident } from '@/lib/corbeille'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { peutQualifier, loadIncidentInScope } from '@/lib/incident-access.server'
import {
  validateIncidentInput, cleanIncidentInput, transitionAutorisee,
  qualificationComplete, type IncidentStatut,
} from '@/lib/incident'
import { Prisma } from '@prisma/client'
import { separerJson } from '@/lib/incident-json'
import { resolveIncidentsConfig } from '@/lib/incidents-config'
import { sanitizeChampsConfig, fusionnerChamps, avecChampsVisibles } from '@/lib/champs-perso'
import { auditLog, getClientIp } from '@/lib/logger'
import { entiteIdPourTexte } from '@/lib/entites.server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/incidents/[id] — qualifier, clôturer, rejeter ou corriger.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadIncidentInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  const { userId, userRole, incident } = c

  const body = await req.json().catch(() => ({}))
  const cfgL1 = resolveIncidentsConfig(c.incidentsConfig)
  // Pertes multi-composantes : si le corps touche aux lignes ou au quasi-incident, on
  // recalcule les agrégats sur l'ENSEMBLE (lignes fournies + lignes déjà enregistrées).
  const toucheLignes = ['pertes', 'recuperationsLignes', 'quasiIncident'].some(k => k in body)
  // Mise à jour PARTIELLE : l'intitulé et le statut enregistrés valent pour la validation quand le corps ne les fournit pas
  // (sinon un simple horodatage DORA ou l'ajout d'un régulateur était refusé « intitulé requis » ou ramenait l'état à DECLARE).
  const base = { intitule: incident.intitule, statut: incident.statut, taxonomieCode: incident.taxonomieCode, ...body }
  const effectif = toucheLignes
    ? { ...base, pertes: body.pertes ?? incident.pertes, recuperationsLignes: body.recuperationsLignes ?? incident.recuperationsLignes, quasiIncident: body.quasiIncident ?? incident.quasiIncident }
    : base
  const erreur = validateIncidentInput(effectif, cfgL1)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanIncidentInput(effectif, cfgL1)

  const depuis = incident.statut as IncidentStatut
  const vers = data.statut
  if (!transitionAutorisee(depuis, vers)) {
    return NextResponse.json({ error: 'transition_interdite' }, { status: 400 })
  }

  // Écriture : le déclarant peut corriger sa déclaration tant qu'elle est DECLARE ;
  // tout changement d'état ou de qualification exige la 2ᵉ ligne.
  const changeEtat = vers !== depuis
  const estDeclarant = incident.declarantId === userId
  if (changeEtat || !(estDeclarant && depuis === 'DECLARE')) {
    if (!peutQualifier(userRole, c.secondeLigneActive)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  }

  // Passer en QUALIFIE suppose la taxonomie renseignée (objet de la qualification).
  if (vers === 'QUALIFIE' && !qualificationComplete({ taxonomieCode: data.taxonomieCode })) {
    return NextResponse.json({ error: 'taxonomie_requise' }, { status: 400 })
  }

  const orgId = incident.organizationId
  if (data.processusId) {
    const p = await prisma.processus.findFirst({ where: { id: data.processusId, organizationId: orgId }, select: { id: true } })
    if (!p) return NextResponse.json({ error: 'processus_invalide' }, { status: 400 })
  }
  if (data.riskItemId) {
    const r = await prisma.riskItem.findFirst({ where: { id: data.riskItemId, organizationId: orgId }, select: { id: true } })
    if (!r) return NextResponse.json({ error: 'risque_invalide' }, { status: 400 })
  }
  // Risques du registre associés (plusieurs, même organisation) : remplacent les liaisons ; le premier = principal.
  const risques = risquesDepuisCorps(body)
  if (risques && risques.length) {
    const n = await prisma.riskItem.count({ where: { id: { in: risques }, organizationId: orgId } })
    if (n !== risques.length) return NextResponse.json({ error: 'risque_invalide' }, { status: 400 })
  }

  // PATCH = mise à jour PARTIELLE : on n'écrit que les champs réellement présents
  // dans le corps. Sans ce filtre, un PATCH de qualification écraserait à null les
  // dates et la maille posées à la déclaration.
  const champsLignes = ['montantBrut', 'recuperations', 'pertes', 'recuperationsLignes', 'quasiIncident']
  const partiel = Object.fromEntries(
    (Object.keys(data) as (keyof typeof data)[])
      .filter(k => k in body || (toucheLignes && champsLignes.includes(k)))
      .map(k => [k, data[k]]),
  ) as Partial<typeof data>
  const { json: champsJson, reste: partielScalaires } = separerJson(partiel)
  // Champs personnalisés (L5) : fusion sans écraser les champs réservés à d'autres rôles.
  const defsChamps = sanitizeChampsConfig(c.champsPersonnalises).incident ?? []
  const json = {
    ...('champs' in body ? { champs: fusionnerChamps(defsChamps, incident.champs, body.champs, userRole) as unknown as Prisma.InputJsonValue } : {}),
    ...champsJson,
  }
  const now = new Date()
  const majIncident = prisma.incident.update({
    where: { id },
    data: {
      ...(risques ? { riskItemId: risques[0] ?? null } : {}),
      ...partielScalaires,
      // Entité modifiée : lien au référentiel recalculé (texte identique) ou retiré (lot E5).
      ...('entite' in partielScalaires ? { entiteId: await entiteIdPourTexte(incident.organizationId, typeof partielScalaires.entite === 'string' ? partielScalaires.entite : null) } : {}),
      ...json,
      // Horodatages posés à la transition, jamais réécrits ensuite.
      ...(vers === 'QUALIFIE' && depuis !== 'QUALIFIE' ? { qualifiePar: userId, qualifieLe: now } : {}),
      ...(vers === 'CLOTURE' && depuis !== 'CLOTURE' ? { clotureLe: now } : {}),
      ...(typeof body.clotureCommentaire === 'string' ? { clotureCommentaire: body.clotureCommentaire.trim() || null } : {}),
    },
  })
  const updated = risques
    ? (await prisma.$transaction([
      majIncident,
      prisma.incidentRisque.deleteMany({ where: { incidentId: id } }),
      ...(risques.length ? [prisma.incidentRisque.createMany({ data: risques.map(riskItemId => ({ incidentId: id, riskItemId })) })] : []),
    ]))[0] as Awaited<typeof majIncident>
    : await majIncident
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'incident', action: changeEtat ? `transition:${depuis}->${vers}` : 'update', id },
  })
  return NextResponse.json(avecChampsVisibles(updated, defsChamps, userRole))
}

// DELETE /api/incidents/[id] — réservé à la 2ᵉ ligne (un incident se rejette
// plutôt qu'il ne se supprime ; la suppression reste possible pour les doublons).
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadIncidentInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  const { userId, userRole, incident } = c
  if (!peutQualifier(userRole, c.secondeLigneActive)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  // Suppression récupérable : instantané (fiche + risques associés) en corbeille, puis suppression, en une transaction.
  const corbeille = await prisma.$transaction(async tx => {
    const complet = await tx.incident.findUnique({ where: { id } })
    if (!complet) return null
    const liens = await tx.incidentRisque.findMany({ where: { incidentId: id }, select: { riskItemId: true } })
    const c = await tx.elementSupprime.create({
      data: {
        organizationId: incident.organizationId, type: 'INCIDENT', objetId: id, intitule: incident.intitule, supprimeParId: userId,
        donnees: instantaneIncident(complet, liens.map(l => l.riskItemId)) as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
    await tx.incident.delete({ where: { id } })
    return c
  })
  if (!corbeille) return NextResponse.json({ error: 'Incident introuvable' }, { status: 404 })
  await auditLog('INCIDENT_DELETED', {
    userId, userRole, organizationId: incident.organizationId, targetId: id, targetType: 'incident', ip: getClientIp(req),
    details: { intitule: incident.intitule, corbeilleId: corbeille.id },
  })
  return NextResponse.json({ ok: true, corbeilleId: corbeille.id })
}
