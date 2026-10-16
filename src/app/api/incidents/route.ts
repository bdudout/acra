import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { withAccess } from '@/lib/with-access.server'
import { validateIncidentInput, cleanIncidentInput, perteNette, delaiDetection } from '@/lib/incident'
import { findDuplicatesForAll, type IncidentDedupItem } from '@/lib/incident-dedup'
import { evaluerReportingIncident } from '@/lib/dora-reporting'
import { type DoraCriteres } from '@/lib/dora'
import { Prisma } from '@prisma/client'
import { separerJson } from '@/lib/incident-json'
import { resolveIncidentsConfig } from '@/lib/incidents-config'
import { vueIncidentL1 } from '@/lib/incident-vue'
import { sanitizeChampsConfig, valeursVisibles, fusionnerChamps, champsRequisManquants } from '@/lib/champs-perso'
import { auditLog, getClientIp } from '@/lib/logger'
import { emitWebhookEvent } from '@/lib/webhook.server'
import { entiteIdPourTexte } from '@/lib/entites.server'
import type { EntiteRef } from '@/lib/entites'
import { lirePagination, paginer, trier } from '@/lib/pagination'
import { lireFiltresColonnes } from '@/lib/liste-colonnes'
import { TRIS_INCIDENTS, COLONNES_INCIDENTS, baseIncidents, filtrerIncidents, lireStatut, syntheseIncidents, texteRisques, valeurTriIncident, type IncidentLeger } from '@/lib/incidents-liste'

export const dynamic = 'force-dynamic'

// Decimal Prisma → number (les montants restent des nombres côté API).
const num = (v: unknown): number | null =>
  v == null ? null : Number(v as unknown as string)

// GET /api/incidents — incidents de l'organisation active (perte nette calculée).
// Sans organisation active : liste vide (pas de 400) → session seule, org active résolue ici.
// `?page=` : liste paginée côté serveur (lot V1, voir lib/incidents-liste) ; `?vue=options` : liste légère
// (doublons probables pendant la saisie d'une déclaration).
const DETAIL = {
  processus: { select: { nom: true } }, riskItem: { select: { intitule: true } },
  risquesLies: { select: { riskItem: { select: { id: true, intitule: true } } }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.IncidentInclude

export const GET = withAccess({ org: 'none' }, async (req, { user }) => {
  const scope = await getAnalyseScope(user.id, user.role)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const { activeOrgId: orgId, role: roleLecture } = scope
  if (!orgId) return NextResponse.json({ incidents: [], active: false })
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.incidentsActive) return NextResponse.json({ incidents: [], active: false })
  const sp = req.nextUrl.searchParams

  if (sp.get('vue') === 'options') {
    const incidents = await prisma.incident.findMany({
      where: { organizationId: orgId }, orderBy: [{ createdAt: 'desc' }],
      select: { id: true, intitule: true, statut: true, dateSurvenance: true, dateDetection: true, processusId: true, entite: true },
    })
    return NextResponse.json({ incidents, active: true })
  }

  const cfgL1 = resolveIncidentsConfig(orgConfig.incidentsConfig)
  const defsChamps = sanitizeChampsConfig(orgConfig.champsPersonnalises).incident ?? []
  const now = new Date()
  const pg = lirePagination(sp, { tris: TRIS_INCIDENTS, triDefaut: 'defaut' })

  let rows
  let pagination = null
  let synthese = null
  let doublonsParId
  if (pg) {
    // Lot V1 : requête LÉGÈRE sur tous les incidents (filtres, tri, tuiles, doublons), détail de la seule page.
    const legers: IncidentLeger[] = (await prisma.incident.findMany({
      where: { organizationId: orgId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true, intitule: true, statut: true, taxonomieCode: true, processusId: true, entite: true, entiteId: true,
        dateSurvenance: true, dateDetection: true, montantBrut: true, recuperations: true, riskItemId: true,
        processus: { select: { nom: true } }, riskItem: { select: { intitule: true } },
        risquesLies: { select: { riskItem: { select: { intitule: true } } }, orderBy: { createdAt: 'asc' } },
      },
    })).map(({ processus, riskItem, risquesLies, montantBrut, recuperations, riskItemId, ...i }) => ({
      ...i,
      processusNom: processus?.nom ?? null,
      perteNette: perteNette(num(montantBrut), num(recuperations)),
      risquesTexte: texteRisques(risquesLies.length ? risquesLies.map(l => l.riskItem) : (riskItemId && riskItem ? [riskItem] : [])),
    }))
    const entite = sp.get('entite') ?? ''
    const entites = entite ? await referentielEntites(orgId) : []
    const base = baseIncidents(legers, { statut: lireStatut(sp.get('statut')), entite, sousEntites: sp.get('sousEntites') !== '0', entites })
    synthese = syntheseIncidents(legers, base)
    const filtres = filtrerIncidents(base, { q: pg.q, colonnes: lireFiltresColonnes(sp, COLONNES_INCIDENTS) })
    const k = valeurTriIncident(pg.tri)
    const page = paginer(k ? trier(filtres, k, pg.ordre) : filtres, pg)
    pagination = page.pagination
    const ids = page.items.map(i => i.id)
    const ordre = new Map(ids.map((id, n) => [id, n]))
    rows = ids.length ? (await prisma.incident.findMany({ where: { id: { in: ids }, organizationId: orgId }, include: DETAIL }))
      .sort((a, b) => (ordre.get(a.id) ?? 0) - (ordre.get(b.id) ?? 0)) : []
    // Doublons probables des seuls incidents de la page, rapprochés de TOUS les incidents.
    doublonsParId = findDuplicatesForAll(legers, {}, new Set(ids))
  } else {
    rows = await prisma.incident.findMany({
      where: { organizationId: orgId },
      orderBy: [{ createdAt: 'desc' }],
      include: DETAIL,
    })
  }
  const incidents = rows.map(({ processus, riskItem, risquesLies, montantBrut, recuperations, ...r }) => {
    const brut = num(montantBrut)
    const recup = num(recuperations)
    return {
      ...r,
      montantBrut: brut,
      recuperations: recup,
      processusNom: processus?.nom ?? null,
      riskItemIntitule: riskItem?.intitule ?? null,
      // Risques du registre associés (plusieurs) ; repli sur le risque principal pour les données antérieures.
      risques: risquesLies.length ? risquesLies.map(l => l.riskItem) : (r.riskItemId && riskItem ? [{ id: r.riskItemId, intitule: riskItem.intitule }] : []),
      perteNette: perteNette(brut, recup),
      // Lot L1 : horloges de notification, totaux convertis, seuils, ventilation par type.
      l1: vueIncidentL1(r, cfgL1, now),
      champs: valeursVisibles(defsChamps, r.champs, roleLecture),
      delaiDetection: delaiDetection(r.dateSurvenance, r.dateDetection),
      // Échéancier de déclaration DORA (art. 19) : classe + phases + synthèse.
      doraReporting: evaluerReportingIncident({
        doraCriteres: r.doraCriteres as DoraCriteres,
        dateDetection: r.dateDetection,
        doraClasseMajeurLe: r.doraClasseMajeurLe,
        doraInitialeSoumiseLe: r.doraInitialeSoumiseLe,
        doraIntermediaireSoumiseLe: r.doraIntermediaireSoumiseLe,
        doraFinaleSoumiseLe: r.doraFinaleSoumiseLe,
      }),
    }
  })

  // Doublons probables (qualité des données de perte : 1 événement = 1 enregistrement).
  // On rapproche chaque incident des autres (hors REJETE) pour aider la 2ᵉ ligne.
  if (!doublonsParId) {
    const dedupItems: IncidentDedupItem[] = incidents.map(i => ({
      id: i.id, intitule: i.intitule, statut: i.statut,
      dateSurvenance: i.dateSurvenance, dateDetection: i.dateDetection,
      processusId: i.processusId, entite: i.entite, taxonomieCode: i.taxonomieCode,
    }))
    // Un seul passage : chaque titre n'est tokenisé qu'une fois (O(n)) au lieu de
    // re-tokeniser toute la liste à chaque incident (O(n²)).
    doublonsParId = findDuplicatesForAll(dedupItems)
  }
  const withDoublons = incidents.map(i => ({
    ...i,
    doublons: (doublonsParId.get(i.id) ?? []).slice(0, 3),
  }))
  return NextResponse.json({ incidents: withDoublons, active: true, config: cfgL1, ...(pagination ? { pagination, synthese } : {}) })
})

/** Référentiel des entités (filtre par entité, sous-entités comprises) — lu seulement si le filtre est demandé. */
async function referentielEntites(orgId: string): Promise<EntiteRef[]> {
  const rows = await prisma.entite.findMany({ where: { organizationId: orgId }, select: { id: true, nom: true, type: true, alias: true, codeExterne: true, parentId: true, source: true, valideAu: true } })
  return rows.map(e => ({ ...e, alias: Array.isArray(e.alias) ? (e.alias as string[]) : [] }))
}

// POST /api/incidents — DÉCLARER un incident.
// Ouvert à TOUS les rôles, LECTEUR inclus : c'est la 1ʳᵉ ligne qui déclare
// (décision produit, cf. docs/ara-grc-spec.md §4 M2). La qualification, elle,
// reste réservée à la 2ᵉ ligne (cf. [id]/route.ts).
export const POST = withAccess({ org: 'active', rateLimit: { bucket: 'incidents' } }, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.incidentsActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const cfgL1 = resolveIncidentsConfig(orgConfig.incidentsConfig)
  const erreur = validateIncidentInput(body, cfgL1)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanIncidentInput(body, cfgL1)

  // Le processus et le risque éventuels doivent appartenir à la même organisation.
  if (data.processusId) {
    const p = await prisma.processus.findFirst({ where: { id: data.processusId, organizationId: orgId }, select: { id: true } })
    if (!p) return NextResponse.json({ error: 'processus_invalide' }, { status: 400 })
  }
  if (data.riskItemId) {
    const r = await prisma.riskItem.findFirst({ where: { id: data.riskItemId, organizationId: orgId }, select: { id: true } })
    if (!r) return NextResponse.json({ error: 'risque_invalide' }, { status: 400 })
  }

  // Une déclaration entre toujours en DECLARE : le statut n'est pas pilotable ici.
  // Champs personnalisés (L5) : validés contre les définitions accessibles au rôle ; requis exigés.
  const defsChamps = sanitizeChampsConfig(orgConfig.champsPersonnalises).incident ?? []
  const champs = fusionnerChamps(defsChamps, {}, body.champs, userRole)
  const manquants = champsRequisManquants(defsChamps, champs, userRole)
  if (manquants.length) return NextResponse.json({ error: 'champs_requis', champs: manquants }, { status: 400 })
  const { statut: _ignore, ...dataSansStatut } = data
  const { json: champsJson, reste: decl } = separerJson(dataSansStatut)
  const incident = await prisma.incident.create({
    data: {
      ...decl, organizationId: orgId, declarantId: userId, statut: 'DECLARE',
      // Lien au référentiel des entités si le texte saisi y est identique (lot E5).
      entiteId: await entiteIdPourTexte(orgId, typeof decl.entite === 'string' ? decl.entite : null),
      ...champsJson,
      champs: champs as unknown as Prisma.InputJsonValue,
    },
  })
  if (incident.riskItemId) await prisma.incidentRisque.create({ data: { incidentId: incident.id, riskItemId: incident.riskItemId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'incident', action: 'declare', id: incident.id },
  })
  await emitWebhookEvent(orgId, 'incident.declared', { id: incident.id, intitule: incident.intitule, statut: incident.statut })
  return NextResponse.json(incident, { status: 201 })
})
