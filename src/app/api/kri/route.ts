import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import {
  validateKriInput, cleanKriInput, evaluerKri, tendanceKri, synthetiserKri,
  type KriSens, type KriStatut,
} from '@/lib/kri'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// La DÉFINITION d'un KRI relève de la 2ᵉ ligne (gouvernance) ; la SAISIE des
// mesures est ouverte à la 1ʳᵉ ligne (cf. mesures/route.ts). L'admin gère aussi.
export function peutDefinirKri(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RISK_MANAGER' || role === 'RSSI'
}

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const userRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  return { userId, userRole, orgId: scope.activeOrgId }
}

// GET /api/kri — KRI de l'organisation active, avec statut courant + tendance + synthèse.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
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
    }
  })

  return NextResponse.json({
    kris,
    // La synthèse ne compte que les KRI actifs (les inactifs ne pilotent plus).
    synthese: synthetiserKri(kris.filter(k => k.actif).map(k => ({ statut: k.statut }))),
    canDefine: peutDefinirKri(userRole),
    active: true,
  })
}

// POST /api/kri — définir un KRI (gouvernance).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!peutDefinirKri(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const cfg = await getOrgConfig(orgId)
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
}
