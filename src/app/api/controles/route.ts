import { NextResponse } from 'next/server'
import { accesResultats } from '@/lib/acces-resultats.server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import {
  validateControleInput, cleanControleInput, prochaineEcheance,
  etatEcheance, evaluerEfficacite, efficaciteEtablie, echantillonTeste, type Periodicite,
} from '@/lib/controle'
import { comparerExecutions, prefillRejeu } from '@/lib/controle-l3b'
import { champsL3Creation, vueControleL3 } from '@/lib/controle-l3'
import { sanitizeChampsConfig, valeursVisibles, fusionnerChamps, champsRequisManquants } from '@/lib/champs-perso'
import { Prisma } from '@prisma/client'
import { verifierRattachements } from '@/lib/controle-rattachements.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { withAccess } from '@/lib/with-access.server'
import { lirePagination, paginer, trier } from '@/lib/pagination'
import { filtrerControles } from '@/lib/controle'

export const dynamic = 'force-dynamic'

// GET /api/controles — bibliothèque de contrôles + échéance et efficacité.
// org: 'none' : sans organisation active, réponse « inactive » (et non 400).
// Tris proposés par la liste paginée (lot V1).
const TRIS = ['defaut', 'intitule', 'responsable', 'niveau', 'echeance', 'derniere'] as const
const DETAIL = {
  processus: { select: { nom: true } },
  riskItem: { select: { intitule: true } },
  executions: { orderBy: { dateRealisation: 'desc' }, select: { id: true, resultat: true, dateRealisation: true, constat: true, preuves: true, checklistResultats: true, independant: true, tailleTestee: true, anomaliesTrouvees: true } },
} satisfies Prisma.ControleInclude

export const GET = withAccess({ org: 'none' }, async (req, { user }) => {
  const userId = user.id
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const { role: roleLecture, activeOrgId: orgId } = await getAnalyseScope(userId, user.role)
  if (!orgId) return NextResponse.json({ controles: [], active: false })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.controlePermanentActive) return NextResponse.json({ controles: [], active: false })
  // Résultats réservés aux interlocuteurs concernés : 1re ligne et lecture seule ne voient que leurs contrôles.
  const acces = await accesResultats(userId, roleLecture as UserRole)
  const visible = <T extends { responsable: string | null }>(l: T[]) => (acces.tout ? l : l.filter(c => acces.concerne(c.responsable)))
  const sp = req.nextUrl.searchParams

  // Menus de sélection (supervision, audit, questionnaires, suggestions) : identifiants et libellés seulement.
  if (sp.get('vue') === 'options') {
    const opts = await prisma.controle.findMany({ where: { organizationId: orgId }, orderBy: { intitule: 'asc' }, select: { id: true, intitule: true, responsable: true, niveau: true, actif: true, executions: { select: { resultat: true } } } })
    // Efficacité légère (résultats seuls) : utile au choix des contrôles N1 supervisés.
    return NextResponse.json({ controles: visible(opts).map(({ executions, ...o }) => {
      const eff = evaluerEfficacite(executions as { resultat: string; dateRealisation: Date }[])
      return { ...o, efficacite: { ...eff, etablie: efficaciteEtablie(eff) } }
    }), active: true })
  }

  const pg = lirePagination(sp, { tris: TRIS, triDefaut: 'defaut' })
  let pagination = null
  let synthese = null
  let tousLesControles
  if (pg) {
    // Lot V1 : requête LÉGÈRE sur toute la bibliothèque (filtres, compteurs, tri sur l'ensemble), détail de la seule page.
    const now0 = new Date()
    const legers = visible(await prisma.controle.findMany({
      where: { organizationId: orgId },
      orderBy: [{ actif: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, intitule: true, responsable: true, niveau: true, referentielCode: true, actif: true, periodicite: true, createdAt: true, executions: { orderBy: { dateRealisation: 'desc' }, select: { resultat: true, dateRealisation: true } } },
    })).map(c => {
      const derniere = c.executions[0]?.dateRealisation ?? null
      const echeance = prochaineEcheance(c.periodicite as Periodicite, derniere, c.createdAt)
      return { ...c, derniere, echeance, etatEcheance: c.actif ? etatEcheance(echeance, now0) : null, anomalies: evaluerEfficacite(c.executions).anomalies }
    })
    synthese = {
      total: legers.length, actifs: legers.filter(c => c.actif).length,
      enRetard: legers.filter(c => c.etatEcheance === 'EN_RETARD').length, dus: legers.filter(c => c.etatEcheance === 'DU').length,
      avecAnomalies: legers.filter(c => c.anomalies > 0).length,
    }
    let filtres = filtrerControles(legers, { q: pg.q, niveau: sp.get('niveau') ?? '', etat: sp.get('etat') ?? '', referentielCode: sp.get('referentielCode') ?? '', actif: sp.get('actif') ?? '' })
    if (sp.get('vue') === 'anomalies') filtres = filtres.filter(c => c.anomalies > 0)
    const cleTri: Record<(typeof TRIS)[number], ((c: (typeof legers)[number]) => unknown) | null> = {
      defaut: null, intitule: c => c.intitule, responsable: c => c.responsable, niveau: c => c.niveau, echeance: c => c.echeance, derniere: c => c.derniere,
    }
    const k = cleTri[pg.tri]
    const page = paginer(k ? trier(filtres, k, pg.ordre) : filtres, pg)
    pagination = page.pagination
    const ordre = new Map(page.items.map((c, i) => [c.id, i]))
    tousLesControles = (await prisma.controle.findMany({ where: { id: { in: page.items.map(c => c.id) } }, include: DETAIL }))
      .sort((a, b) => (ordre.get(a.id) ?? 0) - (ordre.get(b.id) ?? 0))
  } else {
    tousLesControles = visible(await prisma.controle.findMany({
      where: { organizationId: orgId },
      orderBy: [{ actif: 'desc' }, { createdAt: 'desc' }],
      include: DETAIL,
    }))
  }
  const rows = tousLesControles

  const [tiers, projets] = await Promise.all([
    prisma.arrangementTic.findMany({ where: { organizationId: orgId }, select: { id: true, prestataireNom: true }, take: 2000 }),
    prisma.analyse.findMany({ where: { organizationId: orgId, methode: 'PROJET_360', deletedAt: null }, select: { id: true, nom: true }, take: 500 }),
  ])
  const tiersNom = new Map(tiers.map(t => [t.id, t.prestataireNom]))
  const projetNom = new Map(projets.map(x => [x.id, x.nom]))
  const defsChamps = sanitizeChampsConfig(cfg.champsPersonnalises).controle ?? []
  const now = new Date()
  const controles = rows.map(({ processus, riskItem, executions, ...c }) => {
    const derniere = executions[0]?.dateRealisation ?? null
    // Recette n° 36 : efficacité établie à partir de 3 exécutions ; en deçà, ni niveau ni « Défaillant » (indicatif).
    const eff = evaluerEfficacite(executions)
    const etablie = efficaciteEtablie(eff)
    const echeance = prochaineEcheance(c.periodicite as Periodicite, derniere, c.createdAt)
    return {
      ...c,
      champs: valeursVisibles(defsChamps, c.champs, roleLecture),
      processusNom: processus?.nom ?? null,
      tiersNom: c.arrangementTicId ? tiersNom.get(c.arrangementTicId) ?? null : null,
      projetNom: c.projetId ? projetNom.get(c.projetId) ?? null : null,
      n1: comparerExecutions(executions),
      rejeu: prefillRejeu(executions),
      riskItemIntitule: riskItem?.intitule ?? null,
      derniereExecution: derniere,
      prochaineEcheance: echeance,
      // Un contrôle inactif n'a pas d'échéance à honorer.
      etatEcheance: c.actif ? etatEcheance(echeance, now) : null,
      efficacite: { ...eff, etablie, echantillon: echantillonTeste(executions) },
      l3: vueControleL3({ cle: c.cle, modeControle: c.modeControle, periodicite: c.periodicite, actif: c.actif, creeLe: c.createdAt, conception: c.conception, efficacite: etablie ? eff.efficacite : null, executions }, now),
      executions: executions.slice(0, 5),
      nbExecutions: executions.length,
    }
  })
  return NextResponse.json({ controles, active: true, tiers, projets, ...(pagination ? { pagination, synthese } : {}) })
})

// POST /api/controles — créer un contrôle dans la bibliothèque (2ᵉ ligne).
export const POST = withAccess({ org: 'active', rateLimit: { bucket: 'controles' } }, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!peutDefinir2eLigne(userRole, { secondeLigneActive: cfg.secondeLigneActive })) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!cfg.controlePermanentActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateControleInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanControleInput(body)

  if (data.processusId) {
    const p = await prisma.processus.findFirst({ where: { id: data.processusId, organizationId: orgId }, select: { id: true } })
    if (!p) return NextResponse.json({ error: 'processus_invalide' }, { status: 400 })
  }
  if (data.riskItemId) {
    const r = await prisma.riskItem.findFirst({ where: { id: data.riskItemId, organizationId: orgId }, select: { id: true } })
    if (!r) return NextResponse.json({ error: 'risque_invalide' }, { status: 400 })
  }

  const ratt = await verifierRattachements(body, orgId)
  if (!ratt.ok) return NextResponse.json({ error: ratt.error }, { status: 400 })

  const defsChamps = sanitizeChampsConfig(cfg.champsPersonnalises).controle ?? []
  const champs = fusionnerChamps(defsChamps, {}, body.champs, userRole)
  const manquants = champsRequisManquants(defsChamps, champs, userRole)
  if (manquants.length) return NextResponse.json({ error: 'champs_requis', champs: manquants }, { status: 400 })
  const l3 = champsL3Creation(body)
  const controle = await prisma.controle.create({ data: { ...data, ...ratt.data, ...l3, conception: l3.conception as Prisma.InputJsonValue, champs: champs as unknown as Prisma.InputJsonValue, organizationId: orgId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'controle', action: 'create', id: controle.id },
  })
  return NextResponse.json(controle, { status: 201 })
})
