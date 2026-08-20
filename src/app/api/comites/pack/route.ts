import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { niveauRisque } from '@/lib/risk-item'
import { summarizeActions } from '@/lib/risk-action'
import { rollupRisks, type RiskLite } from '@/lib/grc-rollup'
import { rollupIncidents, rollupControles, rollupAudit, type CockpitIncident, type CockpitExecution, type CockpitConstat } from '@/lib/grc-cockpit'
import { synthetiserAppetit, cleanAppetitConfig, type RiskAppetitLite } from '@/lib/appetit'
import { evaluerKri, synthetiserKri, type KriSens } from '@/lib/kri'
import { classifierIncident, estEvalueDora, synthetiserDora, type DoraCriteres, type DoraClasse } from '@/lib/dora'
import { synthetiserSuiviRegulateur, type ConstatRegulateur } from '@/lib/suivi-regulateur'
import { buildComitePack, COMITE_TYPES, type ComiteConsolide, type ComiteType } from '@/lib/comite-pack'
import { auditLog, getClientIp } from '@/lib/logger'
import { createRequire } from 'node:module'

export const dynamic = 'force-dynamic'

// GET /api/comites/pack?type=RISQUES&lang=fr — dossier de comité (PDF).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, instanceRole)
  const role = scope.role
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  // Dossier de gouvernance : 1ʳᵉ ligne « pure » exclue.
  if (role === 'LECTEUR' || role === 'METIER') return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const typeParam = (searchParams.get('type') ?? 'RISQUES').toUpperCase()
  const type: ComiteType = (COMITE_TYPES as readonly string[]).includes(typeParam) ? (typeParam as ComiteType) : 'RISQUES'
  const langParam = searchParams.get('lang')
  const locale = ['fr', 'en', 'de', 'es', 'it'].includes(langParam ?? '') ? (langParam as string) : 'fr'

  const withIncidents = cfg.incidentsActive
  const withControles = cfg.controlePermanentActive
  const withAudit = cfg.auditInterneActive
  const withKri = cfg.kriActive
  const withReglementaire = cfg.reglementaireActive
  const orgFilter = { organizationId: orgId }
  const now = new Date()

  const [riskRows, actionRows, incidentRows, controleRows, executionRows, missionRows, constatRows, kriRows] = await Promise.all([
    prisma.riskItem.findMany({ where: orgFilter, select: { organizationId: true, taxonomieCode: true, graviteInherente: true, vraisemblanceInherente: true, graviteResiduelle: true, vraisemblanceResiduelle: true } }),
    prisma.riskAction.findMany({ where: orgFilter, select: { organizationId: true, statut: true, echeance: true } }),
    withIncidents ? prisma.incident.findMany({ where: orgFilter, select: { organizationId: true, statut: true, montantBrut: true, recuperations: true, doraCriteres: true } }) : Promise.resolve([]),
    withControles ? prisma.controle.findMany({ where: { ...orgFilter, actif: true }, select: { organizationId: true } }) : Promise.resolve([]),
    withControles ? prisma.controleExecution.findMany({ where: orgFilter, select: { organizationId: true, resultat: true, dateRealisation: true } }) : Promise.resolve([]),
    withAudit ? prisma.auditMission.findMany({ where: orgFilter, select: { organizationId: true } }) : Promise.resolve([]),
    (withAudit || withReglementaire) ? prisma.auditConstat.findMany({ where: orgFilter, select: { organizationId: true, criticite: true, statut: true, echeance: true, source: true, intitule: true, recommandation: true, responsableAction: true } }) : Promise.resolve([]),
    withKri ? prisma.kri.findMany({ where: { ...orgFilter, actif: true }, select: { sens: true, seuilAlerte: true, seuilCritique: true, mesures: { orderBy: { dateMesure: 'desc' }, take: 1, select: { valeur: true } } } }) : Promise.resolve([]),
  ])

  const risks: RiskLite[] = riskRows.map(r => ({
    organizationId: r.organizationId,
    niveauInherent: niveauRisque(r.graviteInherente, r.vraisemblanceInherente),
    niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle),
  }))

  const appetit = cleanAppetitConfig(cfg.appetitRisque)
  const appetitDefini = appetit.seuilGlobal != null || Object.keys(appetit.parCategorie).length > 0
  const appetitRows: RiskAppetitLite[] = riskRows.map(r => ({ taxonomieCode: r.taxonomieCode, niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle) }))

  const consolide: ComiteConsolide = { risques: rollupRisks(risks) }
  const act = summarizeActions(actionRows, now)
  consolide.actions = { total: act.total, faits: act.faits, enRetard: act.enRetard, tauxAvancement: act.tauxAvancement }

  if (appetitDefini) {
    const a = synthetiserAppetit(appetitRows, appetit)
    consolide.appetit = { horsAppetit: a.horsAppetit, dansAppetit: a.dansAppetit, evalues: a.evalues }
  }
  if (withIncidents) {
    const incidents: CockpitIncident[] = incidentRows.map(i => ({ organizationId: i.organizationId, statut: i.statut as CockpitIncident['statut'], montantBrut: i.montantBrut == null ? null : Number(i.montantBrut), recuperations: i.recuperations == null ? null : Number(i.recuperations) }))
    consolide.incidents = rollupIncidents(incidents)
  }
  if (withControles) {
    const execs: CockpitExecution[] = executionRows.map(e => ({ organizationId: e.organizationId, resultat: e.resultat, dateRealisation: e.dateRealisation }))
    const cr = rollupControles(controleRows, execs)
    consolide.controles = { tauxConformite: cr.tauxConformite, anomalies: cr.anomalies }
  }
  if (withAudit) {
    const constats: CockpitConstat[] = constatRows.map(c => ({ organizationId: c.organizationId, criticite: c.criticite, statut: c.statut, echeance: c.echeance }))
    const au = rollupAudit(missionRows, constats, now)
    consolide.audit = { critiques: au.critiques, recosEnRetard: au.recosEnRetard }
  }
  if (withReglementaire) {
    const regConstats: ConstatRegulateur[] = constatRows.filter(c => c.source === 'REGULATEUR').map(c => ({ id: '', intitule: c.intitule, description: null, recommandation: c.recommandation, criticite: c.criticite, source: c.source, statut: c.statut, echeance: c.echeance, responsableAction: c.responsableAction, missionIntitule: null }))
    const sr = synthetiserSuiviRegulateur(regConstats, now)
    consolide.regulateur = { echues: sr.echues, sous30j: sr.sous30j }

    const classes: DoraClasse[] = []
    for (const i of incidentRows) {
      const criteres = (i.doraCriteres ?? {}) as DoraCriteres
      if (!estEvalueDora(criteres)) continue
      classes.push(classifierIncident(criteres).classe)
    }
    const d = synthetiserDora(classes)
    consolide.dora = { majeurs: d.majeurs, evalues: d.evalues }
  }
  if (withKri) {
    const statuts = kriRows.map(k => ({ statut: evaluerKri(k.mesures[0]?.valeur ?? null, { sens: k.sens as KriSens, seuilAlerte: k.seuilAlerte, seuilCritique: k.seuilCritique }) }))
    const k = synthetiserKri(statuts)
    consolide.kri = { enAlerte: k.enAlerte, critique: k.critique }
  }

  const pack = buildComitePack(type, consolide, {
    risques: true, appetit: appetitDefini, incidents: withIncidents, controles: withControles,
    audit: withAudit, regulateur: withReglementaire, kri: withKri, dora: withReglementaire,
  })

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'comite-pack', action: 'export', type, format: 'pdf' },
  })

  const stamp = now.toISOString().slice(0, 10)
  try {
    const nodeRequire = createRequire(process.cwd() + '/package.json')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderComitePackPDF } = nodeRequire(process.cwd() + '/.pdf-runtime/comite-pack-pdf-template.cjs')
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { nom: true } })
    const buffer = await renderComitePackPDF(pack, locale, org?.nom ?? '', stamp)
    return new NextResponse(buffer as unknown as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="acra-comite-${type.toLowerCase()}-${stamp}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[export comite pack pdf] génération échouée', err)
    return NextResponse.json({ error: 'Échec de la génération du PDF' }, { status: 500 })
  }
}
