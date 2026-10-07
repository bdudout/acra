// ─── Programme d'audit et de contrôle : vue globale (lot P5) ──────────────────
// GET ?annee=AAAA : lignes de l'année de tous les plans visibles (frise commune), synthèse par plan, sollicitations
// multiples des entités, filiales et tiers, angles morts (risques critiques ou majeurs, processus critiques ou importants
// non audités ni contrôlés depuis le seuil configuré). Dernières couvertures réelles : fin des missions d'audit
// (processus couverts) et exécutions des contrôles (risque et processus rattachés). Calculs : lib/planification-vue.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contextePlan, donneesRealisations, etatRealisation } from '@/lib/planification.server'
import { TYPES_PLAN, cleanRealisations, statutLigne, tauxRealisation } from '@/lib/planification'
import { anglesMorts, sollicitationsMultiples, type LigneVue } from '@/lib/planification-vue'

export const dynamic = 'force-dynamic'
const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const liste = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

export async function GET(req: NextRequest): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const maintenant = new Date()
  const demandee = Number(req.nextUrl.searchParams.get('annee'))
  const annee = Number.isInteger(demandee) && demandee >= 2000 && demandee <= 2100 ? demandee : maintenant.getUTCFullYear()
  const types = TYPES_PLAN.filter(t => c.modules[t])

  const plans = await prisma.planProgramme.findMany({
    where: { organizationId: c.orgId, type: { in: [...types] } },
    select: { id: true, nom: true, type: true, equipe: true, annees: { where: { annee }, select: { statut: true } }, lignes: { where: { annee: { gte: annee } } } },
    orderBy: [{ type: 'asc' }, { nom: 'asc' }],
  })
  const lignes: LigneVue[] = plans.flatMap(p => p.lignes.filter(l => l.annee === annee).map(l => ({
    ligneId: l.id, planId: p.id, planNom: p.nom, type: p.type as 'AUDIT' | 'CONTROLE', intitule: l.intitule,
    debut: jour(l.debut), fin: jour(l.fin), statutManuel: l.statutManuel, priorite: l.priorite, cibles: (l.cibles ?? {}) as LigneVue['cibles'],
  })))
  // Prévus : lignes actives de l'année affichée et des suivantes.
  const prevues = plans.flatMap(p => p.lignes).filter(l => l.statutManuel !== 'ANNULEE')
  const cibles = (k: 'risques' | 'processus') => [...new Set(prevues.flatMap(l => liste((l.cibles as Record<string, unknown>)?.[k])))]

  const org = await prisma.organization.findUnique({ where: { id: c.orgId }, select: { path: true } })
  const [organisations, tiers, risques, processus, missions, controles] = await Promise.all([
    prisma.organization.findMany({ where: { path: { startsWith: org?.path ?? `/${c.orgId}/` } }, select: { id: true, nom: true } }),
    prisma.tierOrganization.findMany({ where: { organizationId: c.orgId }, select: { tier: { select: { id: true, nom: true } } } }),
    prisma.riskItem.findMany({ where: { organizationId: c.orgId }, select: { id: true, intitule: true, graviteInherente: true, vraisemblanceInherente: true, graviteResiduelle: true, vraisemblanceResiduelle: true } }),
    prisma.processus.findMany({ where: { organizationId: c.orgId }, select: { id: true, nom: true, criticite: true, criticiteDora: true } }),
    prisma.auditMission.findMany({ where: { organizationId: c.orgId }, select: { dateDebut: true, dateFin: true, processusIds: true } }),
    prisma.controle.findMany({ where: { organizationId: c.orgId }, select: { riskItemId: true, processusId: true, executions: { select: { dateRealisation: true }, orderBy: { dateRealisation: 'desc' }, take: 1 } } }),
  ])

  // Dernière couverture réelle (passée) par risque et par processus.
  const aujourdhui = jour(maintenant) as string
  const derniere = { risques: {} as Record<string, string>, processus: {} as Record<string, string> }
  const noter = (map: Record<string, string>, id: string | null, d: string | null) => { if (id && d && d <= aujourdhui && (!map[id] || map[id] < d)) map[id] = d }
  for (const m of missions) for (const p of liste(m.processusIds)) noter(derniere.processus, p, jour(m.dateFin ?? m.dateDebut))
  for (const ct of controles) {
    const d = jour(ct.executions[0]?.dateRealisation ?? null)
    noter(derniere.risques, ct.riskItemId, d); noter(derniere.processus, ct.processusId, d)
  }

  // Statuts calculés des lignes de l'année (réalisations rattachées, période) → taux de réalisation par plan (lot P4).
  const donnees = await donneesRealisations(c.orgId)
  const statutDe = new Map(plans.flatMap(p => p.lignes.filter(l => l.annee === annee).map(l => [l.id, statutLigne(
    { debut: jour(l.debut), fin: jour(l.fin), statutManuel: l.statutManuel },
    cleanRealisations(l.realisations).flatMap(r => { const e = etatRealisation(r, annee, donnees); return e ? [{ statut: e.statut }] : [] }),
    aujourdhui,
  )] as const)))
  const noms = Object.fromEntries([...organisations.map(o => [o.id, o.nom]), ...tiers.map(t => [t.tier.id, t.tier.nom])])
  return NextResponse.json({
    annee,
    seuilAnglesMortsAns: c.cfg.seuilAnglesMortsAns,
    plans: plans.map(p => {
      const ls = lignes.filter(l => l.planId === p.id)
      return { id: p.id, nom: p.nom, type: p.type, equipe: p.equipe, statut: p.annees[0]?.statut ?? null, lignes: ls.length, annulees: ls.filter(l => l.statutManuel === 'ANNULEE').length, reportees: ls.filter(l => l.statutManuel === 'REPORTEE').length, realisation: tauxRealisation(ls.map(l => statutDe.get(l.ligneId) ?? 'A_VENIR')) }
    }),
    lignes,
    sollicitations: sollicitationsMultiples(lignes, noms),
    anglesMorts: anglesMorts({ maintenant, seuilAns: c.cfg.seuilAnglesMortsAns, risques, processus, dernieresCouvertures: derniere, prevus: { risques: cibles('risques'), processus: cibles('processus') } }),
  })
}
