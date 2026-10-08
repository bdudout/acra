// ─── Rapprochement des textes libres « entité » (consolidation, lot E3) ───────
// GET : valeurs distinctes du champ texte `entite` encore sans lien (risques, incidents, suivis de conformité, plans
// d'action, traitements, mesures) de l'organisation active, avec la proposition d'entité. POST : décisions de l'ADMIN
// appliquées en transaction — lien `entiteId` posé sur les objets non encore liés (texte conservé), variante ajoutée en
// alias de l'entité, ou entité créée à partir de la valeur.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { contexteEntites, perimetreSource } from '@/lib/entites.server'
import type { EntiteRef } from '@/lib/entites'
import { planifierRapprochement, proposerRapprochements, regrouperValeurs, type SourceTexte } from '@/lib/entites-rapprochement'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, LIMIT_API_WRITE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

type Client = Pick<typeof prisma, 'riskItem' | 'incident' | 'conformite' | 'planAction' | 'conformiteTraitement' | 'mesure' | 'entite'>
const perimetre = perimetreSource

async function lireValeurs(db: Client, orgId: string) {
  const ou = (s: SourceTexte) => ({ ...perimetre(orgId, s), entiteId: null, entite: { not: null } })
  const args = (s: SourceTexte) => ({ by: ['entite'] as ['entite'], where: ou(s), _count: { _all: true as const } })
  const lus: [SourceTexte, { entite: string | null; _count: { _all: number } }[]][] = await Promise.all([
    db.riskItem.groupBy(args('risques')).then(r => ['risques', r] as [SourceTexte, typeof r]),
    db.incident.groupBy(args('incidents')).then(r => ['incidents', r] as [SourceTexte, typeof r]),
    db.conformite.groupBy({ ...args('conformites'), where: { ...perimetre(orgId, 'conformites'), entiteId: null } }).then(r => ['conformites', r] as [SourceTexte, typeof r]),
    db.planAction.groupBy(args('plansAction')).then(r => ['plansAction', r] as [SourceTexte, typeof r]),
    db.conformiteTraitement.groupBy({ ...args('traitementsConformite'), where: { ...perimetre(orgId, 'traitementsConformite'), entiteId: null } }).then(r => ['traitementsConformite', r] as [SourceTexte, typeof r]),
    db.mesure.groupBy(args('mesures')).then(r => ['mesures', r] as [SourceTexte, typeof r]),
  ])
  return regrouperValeurs(lus.flatMap(([source, rows]) => rows.map(r => ({ source, valeur: r.entite, n: r._count._all }))))
}

async function lireEntites(db: Client, orgId: string): Promise<EntiteRef[]> {
  const rows = await db.entite.findMany({ where: { organizationId: orgId }, select: { id: true, nom: true, type: true, alias: true, codeExterne: true, parentId: true, source: true, valideAu: true } })
  return rows.map(r => ({ ...r, alias: Array.isArray(r.alias) ? (r.alias as string[]) : [] }))
}

export async function GET(): Promise<NextResponse> {
  const c = await contexteEntites()
  if ('error' in c) return c.error
  if (!c.admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const [valeurs, entites] = await Promise.all([lireValeurs(prisma, c.orgId), lireEntites(prisma, c.orgId)])
  return NextResponse.json({ propositions: proposerRapprochements(valeurs, entites) })
}

const schema = z.object({ decisions: z.array(z.union([
  z.object({ valeur: z.string().min(1).max(500), entiteId: z.string().min(1).max(64) }),
  z.object({ valeur: z.string().min(1).max(500), creer: z.string().max(20) }),
])).min(1).max(1000) })

export async function POST(req: NextRequest): Promise<NextResponse> {
  const c = await contexteEntites()
  if ('error' in c) return c.error
  if (!c.admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const rl = await rateLimit(`entites:${c.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })

  const res = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${c.orgId}), hashtext('entites-rapprochement'))::text`
    // Plan recalculé sur l'état courant : une valeur liée entre-temps n'est plus proposée.
    const [valeurs, entites] = await Promise.all([lireValeurs(tx, c.orgId), lireEntites(tx, c.orgId)])
    const plan = planifierRapprochement(parsed.data.decisions, valeurs, entites)
    if (plan.erreur) return { erreur: plan.erreur }
    const liens = [...plan.liens]
    for (const cr of plan.creations) {
      const e = await tx.entite.create({ data: { organizationId: c.orgId, nom: cr.nom, type: cr.type, source: 'MANUEL' } })
      liens.push({ brutes: cr.brutes, entiteId: e.id })
    }
    let objets = 0
    for (const l of liens) {
      const ou = (s: SourceTexte) => ({ where: { ...perimetre(c.orgId, s), entiteId: null, entite: { in: l.brutes } }, data: { entiteId: l.entiteId } })
      const r = await Promise.all([
        tx.riskItem.updateMany(ou('risques')), tx.incident.updateMany(ou('incidents')), tx.conformite.updateMany(ou('conformites')),
        tx.planAction.updateMany(ou('plansAction')), tx.conformiteTraitement.updateMany(ou('traitementsConformite')), tx.mesure.updateMany(ou('mesures')),
      ])
      objets += r.reduce((a, b) => a + b.count, 0)
    }
    for (const [id, ajouts] of Object.entries(plan.aliasAjoutes)) {
      const e = entites.find(x => x.id === id)!
      await tx.entite.update({ where: { id }, data: { alias: [...e.alias, ...ajouts] } })
    }
    return { liens: liens.length, creees: plan.creations.length, objets }
  })
  if ('erreur' in res) return NextResponse.json({ error: res.erreur }, { status: 400 })
  await auditLog('ENTITE_REFERENTIEL_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'entite', details: { action: 'rapprochement', ...res } })
  return NextResponse.json(res)
}
