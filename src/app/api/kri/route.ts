import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { requireSession } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import {
  validateKriInput, cleanKriInput, evaluerKri, tendanceKri, synthetiserKri,
  type KriSens, type KriStatut,
  debutPeriodeKri, suggestionIncidentsKri,
} from '@/lib/kri'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// La DÉFINITION d'un KRI relève de la 2ᵉ ligne (gouvernance) ; la SAISIE des
// mesures est ouverte à la 1ʳᵉ ligne (cf. mesures/route.ts). L'admin gère aussi.
import { peutDefinirKri, optionsDefinition } from '@/lib/permissions'

// GET /api/kri — KRI de l'organisation active, avec statut courant + tendance + synthèse.
// Sans organisation active : liste vide (pas de 400) → requireSession.
export async function GET() {
  const g = await requireSession()
  if (g.error) return g.error
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const { role: userRole, activeOrgId: orgId } = await getAnalyseScope(g.user.id, g.user.role)
  if (!orgId) return NextResponse.json({ kris: [], active: false })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.kriActive) return NextResponse.json({ kris: [], active: false })

  const rows = await prisma.kri.findMany({
    where: { organizationId: orgId },
    orderBy: [{ actif: 'desc' }, { createdAt: 'desc' }],
    include: {
      mesures: { orderBy: { dateMesure: 'desc' }, take: 2, select: { valeur: true, dateMesure: true } },
      riskItem: { select: { intitule: true } },
    },
  })

  // Recette n° 35 : incidents de l'année (catégories des KRI) pour suggérer la mesure de la période.
  const codes = [...new Set(rows.map(r => r.taxonomieCode).filter((c): c is string => !!c))]
  const now = new Date()
  const incidents = cfg.incidentsActive && codes.length
    ? await prisma.incident.findMany({
        where: { organizationId: orgId, taxonomieCode: { in: codes }, statut: { not: 'REJETE' }, OR: [{ dateSurvenance: { gte: debutPeriodeKri('ANNUEL', now) } }, { dateSurvenance: null, createdAt: { gte: debutPeriodeKri('ANNUEL', now) } }] },
        select: { taxonomieCode: true, dateSurvenance: true, createdAt: true }, take: 5000,
      })
    : []

  const kris = rows.map(({ mesures, riskItem, ...k }) => {
    const derniere = mesures[0]?.valeur ?? null
    const precedente = mesures[1]?.valeur ?? null
    const statut: KriStatut = evaluerKri(derniere, { sens: k.sens as KriSens, seuilAlerte: k.seuilAlerte, seuilCritique: k.seuilCritique })
    return {
      ...k,
      riskIntitule: riskItem?.intitule ?? null,
      derniereValeur: derniere,
      derniereMesureLe: mesures[0]?.dateMesure ?? null,
      statut,
      tendance: tendanceKri(derniere, precedente, k.sens as KriSens),
      suggestionIncidents: cfg.incidentsActive ? suggestionIncidentsKri(k, incidents, now) : null,
    }
  })

  return NextResponse.json({
    kris,
    // La synthèse ne compte que les KRI actifs (les inactifs ne pilotent plus).
    synthese: synthetiserKri(kris.filter(k => k.actif).map(k => ({ statut: k.statut }))),
    canDefine: peutDefinirKri(userRole, optionsDefinition(cfg)),
    active: true,
  })
}

// POST /api/kri — définir un KRI (gouvernance).
export const POST = withAccess({ org: 'active', rateLimit: { bucket: 'kri' } }, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!peutDefinirKri(userRole, optionsDefinition(cfg))) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!cfg.kriActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateKriInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanKriInput(body)

  if (data.riskItemId) {
    const r = await prisma.riskItem.findFirst({ where: { id: data.riskItemId, organizationId: orgId }, select: { id: true } })
    if (!r) return NextResponse.json({ error: 'risque_invalide' }, { status: 400 })
  }

  const kri = await prisma.kri.create({ data: { ...data, organizationId: orgId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'kri', action: 'create', id: kri.id },
  })
  return NextResponse.json(kri, { status: 201 })
})
