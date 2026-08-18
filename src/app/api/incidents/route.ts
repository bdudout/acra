import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { validateIncidentInput, cleanIncidentInput, perteNette, delaiDetection } from '@/lib/incident'
import { evaluerReportingIncident } from '@/lib/dora-reporting'
import { type DoraCriteres } from '@/lib/dora'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  return { userId, userRole, orgId: scope.activeOrgId }
}

// Decimal Prisma → number (les montants restent des nombres côté API).
const num = (v: unknown): number | null =>
  v == null ? null : Number(v as unknown as string)

// GET /api/incidents — incidents de l'organisation active (perte nette calculée).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ incidents: [], active: false })
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.incidentsActive) return NextResponse.json({ incidents: [], active: false })

  const rows = await prisma.incident.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    include: { processus: { select: { nom: true } }, riskItem: { select: { intitule: true } } },
  })
  const incidents = rows.map(({ processus, riskItem, montantBrut, recuperations, ...r }) => {
    const brut = num(montantBrut)
    const recup = num(recuperations)
    return {
      ...r,
      montantBrut: brut,
      recuperations: recup,
      processusNom: processus?.nom ?? null,
      riskItemIntitule: riskItem?.intitule ?? null,
      perteNette: perteNette(brut, recup),
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
  return NextResponse.json({ incidents, active: true })
}

// POST /api/incidents — DÉCLARER un incident.
// Ouvert à TOUS les rôles, LECTEUR inclus : c'est la 1ʳᵉ ligne qui déclare
// (décision produit, cf. docs/ara-grc-spec.md §4 M2). La qualification, elle,
// reste réservée à la 2ᵉ ligne (cf. [id]/route.ts).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.incidentsActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateIncidentInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanIncidentInput(body)

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
  const { statut: _ignore, ...decl } = data
  const incident = await prisma.incident.create({
    data: { ...decl, organizationId: orgId, declarantId: userId, statut: 'DECLARE' },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'incident', action: 'declare', id: incident.id },
  })
  return NextResponse.json(incident, { status: 201 })
}
