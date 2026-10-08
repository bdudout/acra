// ─── Réorganisations du référentiel des entités (consolidation, lot E4) ───────
// GET : historique de l'organisation active (tout membre), 5 dernières années, du plus récent au plus ancien.
// POST : opération datée (renommage, fusion, scission, clôture) appliquée par l'ADMIN en transaction : créations,
// report des références (risques, incidents, conformité, plans, traitements, mesures) avec la liste des objets déplacés,
// sous-entités rattachées au successeur, clôture à la date d'effet, événement historisé, purge au-delà de 5 ans.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contexteEntites, perimetreSource } from '@/lib/entites.server'
import { dateLimiteHistorique, type EntiteRef } from '@/lib/entites'
import { SOURCES_TEXTE, type SourceTexte } from '@/lib/entites-rapprochement'
import { planifierReorganisation, type Destination, type OperationReorganisation } from '@/lib/entites-reorganisation'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, LIMIT_API_WRITE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

type Tx = Pick<typeof prisma, 'riskItem' | 'incident' | 'conformite' | 'planAction' | 'conformiteTraitement' | 'mesure'>
const MODELE: Record<SourceTexte, keyof Tx> = { risques: 'riskItem', incidents: 'incident', conformites: 'conformite', plansAction: 'planAction', traitementsConformite: 'conformiteTraitement', mesures: 'mesure' }
type Delegue = { findMany(a: object): Promise<{ id: string }[]>; updateMany(a: object): Promise<{ count: number }> }

export async function GET(): Promise<NextResponse> {
  const c = await contexteEntites()
  if ('error' in c) return c.error
  const evenements = await prisma.entiteEvenement.findMany({
    where: { organizationId: c.orgId, dateEffet: { gte: dateLimiteHistorique() } },
    orderBy: [{ dateEffet: 'desc' }, { createdAt: 'desc' }], take: 200,
  })
  const nb = (o: unknown) => Object.values((o ?? {}) as Record<string, Record<string, string[]>>).reduce((t, parSource) => t + Object.values(parSource).reduce((u, ids) => u + ids.length, 0), 0)
  return NextResponse.json({ evenements: evenements.map(({ objets, ...e }) => ({ ...e, nbObjets: nb(objets) })) })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const c = await contexteEntites()
  if ('error' in c) return c.error
  if (!c.admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const rl = await rateLimit(`entites:${c.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  const op = (await req.json().catch(() => null)) as OperationReorganisation | null
  if (!op || typeof op !== 'object' || !Array.isArray(op.sources) || op.sources.length > 50) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })

  const res = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${c.orgId}), hashtext('entites-reorganisation'))::text`
    const rows = await tx.entite.findMany({ where: { organizationId: c.orgId }, select: { id: true, nom: true, type: true, alias: true, codeExterne: true, parentId: true, source: true, valideAu: true } })
    const entites: EntiteRef[] = rows.map(r => ({ ...r, alias: Array.isArray(r.alias) ? (r.alias as string[]) : [] }))
    const plan = planifierReorganisation(op, entites)
    if (!plan.ok) return { erreur: plan.error }
    const nomDe = new Map(entites.map(e => [e.id, e.nom]))

    const creees: { id: string; nom: string }[] = []
    for (const cr of plan.creations) {
      const e = await tx.entite.create({ data: { organizationId: c.orgId, nom: cr.nom, type: cr.type, parentId: cr.parentId, alias: cr.alias, source: 'MANUEL', valideDu: plan.dateEffet } })
      creees.push({ id: e.id, nom: e.nom })
    }
    const idDe = (d: Destination) => ('id' in d ? d.id : creees[d.creation].id)

    // Report des références : objets listés avant le déplacement (historique), puis déplacés.
    const objets: Record<string, Partial<Record<SourceTexte, string[]>>> = {}
    let total = 0
    for (const t of plan.transferts) {
      const vers = idDe(t.vers)
      for (const s of SOURCES_TEXTE) {
        const modele = tx[MODELE[s]] as unknown as Delegue
        const where = { ...perimetreSource(c.orgId, s), entiteId: t.de }
        const ids = (await modele.findMany({ where, select: { id: true } })).map(x => x.id)
        if (!ids.length) continue
        ;(objets[t.de] ??= {})[s] = ids
        total += ids.length
        await modele.updateMany({ where, data: { entiteId: vers } })
      }
    }
    for (const se of plan.sousEntites) {
      const vers = idDe(se.vers)
      await tx.entite.updateMany({ where: { organizationId: c.orgId, parentId: se.de, id: { not: vers } }, data: { parentId: vers } })
    }
    if (plan.renommage) await tx.entite.update({ where: { id: plan.renommage.id }, data: { nom: plan.renommage.nom, alias: plan.renommage.alias } })
    for (const [id, ajouts] of Object.entries(plan.aliasAjoutes)) {
      const e = entites.find(x => x.id === id)!
      await tx.entite.update({ where: { id }, data: { alias: [...e.alias, ...ajouts] } })
    }
    if (plan.clore.length) await tx.entite.updateMany({ where: { organizationId: c.orgId, id: { in: plan.clore } }, data: { valideAu: plan.dateEffet } })

    const sources = op.sources.filter((id, i, a) => a.indexOf(id) === i).map(id => ({ id, nom: nomDe.get(id) ?? id }))
    const destinations = [...new Set(plan.transferts.map(t => idDe(t.vers)))].filter(id => !creees.some(x => x.id === id)).map(id => ({ id, nom: nomDe.get(id) ?? id }))
    const cibles = plan.renommage ? [{ id: plan.renommage.id, nom: plan.renommage.nom }] : [...destinations, ...creees]
    const ev = await tx.entiteEvenement.create({ data: { organizationId: c.orgId, type: plan.type, dateEffet: plan.dateEffet, sources, cibles, objets, auteurId: c.userId } })
    // Rétention : historique des réorganisations conservé 5 ans.
    await tx.entiteEvenement.deleteMany({ where: { organizationId: c.orgId, dateEffet: { lt: dateLimiteHistorique() } } })
    return { evenement: ev.id, type: plan.type, creees: creees.length, closes: plan.clore.length, objets: total }
  })
  if ('erreur' in res) return NextResponse.json({ error: res.erreur }, { status: 400 })
  await auditLog('ENTITE_REFERENTIEL_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'entite', targetId: res.evenement, details: { action: 'reorganisation', ...res } })
  return NextResponse.json(res, { status: 201 })
}
