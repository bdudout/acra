import { incidentsParRisque } from '@/lib/incident-risques'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { withAccess } from '@/lib/with-access.server'
import { validateRiskItemInput, cleanRiskItem, niveauRisque } from '@/lib/risk-item'
import { summarizeActions } from '@/lib/risk-action'
import { riskActionsByRiskItem } from '@/lib/plan-action.server'
import { suggestCalibration, type IncidentLite } from '@/lib/incident'
import { evaluerEfficacite } from '@/lib/controle'
import { auditLog, getClientIp } from '@/lib/logger'
import { emitWebhookEvent } from '@/lib/webhook.server'
import { entiteIdPourTexte } from '@/lib/entites.server'
import { lirePagination, paginer, trier } from '@/lib/pagination'
import { lireFiltresColonnes } from '@/lib/liste-colonnes'
import { TRIS_RISQUES, COLONNES_RISQUES, baseRisques, filtrerRisques, lireNiveau, syntheseRisques, valeurTriRisque, type RisqueLeger } from '@/lib/risk-items-liste'

export const dynamic = 'force-dynamic'

// GET /api/risk-items — registre de l'organisation active (avec niveau calculé).
// Sans organisation active : liste vide (pas d'erreur) → session seule, org active résolue ici.
export const GET = withAccess({ org: 'none' }, async (req, { user }) => {
  const { activeOrgId: orgId } = await getAnalyseScope(user.id, user.role)
  if (!orgId) return NextResponse.json({ risks: [], active: false })
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.registreRisquesActive) return NextResponse.json({ risks: [], active: false })

  // Menus de sélection (contrôles, KRI, constats, questionnaires…) : identifiants et libellés seulement (lot V1).
  if (req.nextUrl.searchParams.get('vue') === 'options') {
    const risks = await prisma.riskItem.findMany({ where: { organizationId: orgId }, orderBy: { intitule: 'asc' }, select: { id: true, intitule: true } })
    return NextResponse.json({ risks, active: true })
  }

  const sp = req.nextUrl.searchParams
  const pg = lirePagination(sp, { tris: TRIS_RISQUES, triDefaut: 'defaut' })
  let rows
  let pagination = null
  let synthese = null
  // Jointures (actions, incidents, exécutions de contrôles) limitées aux risques renvoyés : toute la liste sans
  // `page` (réponse historique), la seule page sinon.
  let restreint: string[] | null = null
  if (pg) {
    // Lot V1 : requête LÉGÈRE sur tout le registre (filtres, tri, compteurs), détail de la seule page.
    const legers: RisqueLeger[] = (await prisma.riskItem.findMany({
      where: { organizationId: orgId },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, intitule: true, taxonomieCode: true, entite: true, proprietaire: true, statut: true, graviteInherente: true, vraisemblanceInherente: true, graviteResiduelle: true, vraisemblanceResiduelle: true, processus: { select: { nom: true } } },
    })).map(r => ({
      id: r.id, intitule: r.intitule, taxonomieCode: r.taxonomieCode, entite: r.entite, proprietaire: r.proprietaire, statut: r.statut,
      processusNom: r.processus?.nom ?? null,
      niveauInherent: niveauRisque(r.graviteInherente, r.vraisemblanceInherente),
      niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle),
    }))
    const base = baseRisques(legers, lireNiveau(sp.get('niveau')))
    synthese = syntheseRisques(legers, base)
    const filtres = filtrerRisques(base, { q: pg.q, colonnes: lireFiltresColonnes(sp, COLONNES_RISQUES) })
    // Tri par avancement du plan d'action : seul cas où les actions de tout le registre sont lues (statut + échéance).
    if (pg.tri === 'actions') {
      const toutes = await riskActionsByRiskItem(prisma, orgId)
      const now0 = new Date()
      for (const x of filtres) x.tauxAvancement = summarizeActions(toutes.get(x.id) ?? [], now0).tauxAvancement
    }
    const k = valeurTriRisque(pg.tri)
    const page = paginer(k ? trier(filtres, k, pg.ordre) : filtres, pg)
    pagination = page.pagination
    restreint = page.items.map(x => x.id)
    const ordre = new Map(restreint.map((id, i) => [id, i]))
    rows = (await prisma.riskItem.findMany({ where: { id: { in: restreint }, organizationId: orgId }, include: { processus: { select: { nom: true } } } }))
      .sort((a, b) => (ordre.get(a.id) ?? 0) - (ordre.get(b.id) ?? 0))
  } else {
    rows = await prisma.riskItem.findMany({
      where: { organizationId: orgId },
      orderBy: [{ createdAt: 'desc' }],
      include: { processus: { select: { nom: true } } },
    })
  }
  // Actions du registre = PlanAction à lien RISQUE, regroupées par risque.
  const actionsParRisque = restreint ? await actionsDesRisques(orgId, restreint) : await riskActionsByRiskItem(prisma, orgId)

  // Boucle M2 : si le module incidents est actif, on joint la fréquence observée
  // pour proposer une vraisemblance résiduelle (SUGGESTION, jamais appliquée).
  let incidentsLies: IncidentLite[] = []
  if (orgConfig.incidentsActive && restreint?.length !== 0) {
    // Un incident associé à plusieurs risques compte pour chacun (table IncidentRisque ; repli sur le principal).
    const lien = restreint
      ? [{ riskItemId: { in: restreint } }, { risquesLies: { some: { riskItemId: { in: restreint } } } }]
      : [{ riskItemId: { not: null } }, { risquesLies: { some: {} } }]
    const inc = await prisma.incident.findMany({
      where: { organizationId: orgId, statut: { in: ['QUALIFIE', 'CLOTURE'] }, OR: lien },
      select: { riskItemId: true, dateSurvenance: true, montantBrut: true, recuperations: true, risquesLies: { select: { riskItemId: true } } },
    })
    incidentsLies = incidentsParRisque(inc.map(i => ({
      riskItemIds: i.risquesLies.length ? i.risquesLies.map(l => l.riskItemId) : (i.riskItemId ? [i.riskItemId] : []),
      dateSurvenance: i.dateSurvenance,
      montantBrut: i.montantBrut == null ? null : Number(i.montantBrut as unknown as string),
      recuperations: i.recuperations == null ? null : Number(i.recuperations as unknown as string),
    })))
  }

  // Boucle M3 : efficacité des contrôles rattachés au risque → suggestion de
  // vraisemblance résiduelle (les contrôles inactifs ne comptent pas).
  const execsParRisque = new Map<string, { resultat: string; dateRealisation: Date }[]>()
  if (orgConfig.controlePermanentActive && restreint?.length !== 0) {
    const ctrls = await prisma.controle.findMany({
      where: { organizationId: orgId, actif: true, riskItemId: restreint ? { in: restreint } : { not: null } },
      select: { riskItemId: true, executions: { select: { resultat: true, dateRealisation: true } } },
    })
    for (const c of ctrls) {
      if (!c.riskItemId) continue
      const arr = execsParRisque.get(c.riskItemId) ?? []
      arr.push(...c.executions)
      execsParRisque.set(c.riskItemId, arr)
    }
  }

  const now = new Date()
  const risks = rows.map(({ processus, ...r }) => ({
    ...r,
    processusNom: processus?.nom ?? null,
    niveauInherent: niveauRisque(r.graviteInherente, r.vraisemblanceInherente),
    niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle),
    actionsSummary: summarizeActions(actionsParRisque.get(r.id) ?? [], now),
    calibration: orgConfig.incidentsActive ? suggestCalibration(incidentsLies, r.id) : null,
    controleEfficacite: orgConfig.controlePermanentActive ? evaluerEfficacite(execsParRisque.get(r.id) ?? []) : null,
  }))
  return NextResponse.json({ risks, active: true, ...(pagination ? { pagination, synthese } : {}) })
})

/** Actions (statut, échéance) des seuls risques de la page : PlanAction à lien RISQUE vers l'un d'eux. */
async function actionsDesRisques(orgId: string, ids: string[]): Promise<Map<string, { statut: string; echeance: Date | null }[]>> {
  const map = new Map<string, { statut: string; echeance: Date | null }[]>()
  if (!ids.length) return map
  const page = new Set(ids)
  const rows = await prisma.planAction.findMany({
    where: { organizationId: orgId, liens: { some: { type: 'RISQUE', targetId: { in: ids } } } },
    select: { statut: true, echeance: true, liens: { where: { type: 'RISQUE' }, select: { targetId: true }, take: 1 } },
  })
  // Même rattachement que riskActionsByRiskItem : le PREMIER lien RISQUE de l'action.
  for (const r of rows) {
    const id = r.liens[0]?.targetId
    if (!id || !page.has(id)) continue
    const arr = map.get(id) ?? []
    arr.push({ statut: r.statut, echeance: r.echeance })
    map.set(id, arr)
  }
  return map
}

// POST /api/risk-items — déclarer un risque (tout rôle sauf LECTEUR, module actif).
export const POST = withAccess({ org: 'active', rateLimit: { bucket: 'risk-items' } }, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  if (userRole === 'LECTEUR') return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateRiskItemInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanRiskItem(body)
  // Le processus éventuel doit appartenir à la même organisation.
  if (data.processusId) {
    const p = await prisma.processus.findFirst({ where: { id: data.processusId, organizationId: orgId }, select: { id: true } })
    if (!p) return NextResponse.json({ error: 'processus_invalide' }, { status: 400 })
  }
  // Lien au référentiel des entités si le texte saisi y est identique (consolidation des entités).
  const risk = await prisma.riskItem.create({ data: { ...data, organizationId: orgId, provenance: 'MANUEL', entiteId: await entiteIdPourTexte(orgId, data.entite) } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole, ip: getClientIp(req), details: { scope: 'risk-item', action: 'create', id: risk.id, intitule: data.intitule } })
  await emitWebhookEvent(orgId, 'risk.created', { id: risk.id, intitule: risk.intitule })
  return NextResponse.json(risk, { status: 201 })
})
