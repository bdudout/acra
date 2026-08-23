import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import {
  validateControleInput, cleanControleInput, prochaineEcheance,
  etatEcheance, evaluerEfficacite, type Periodicite,
} from '@/lib/controle'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** Définir le plan de contrôle relève de la 2ᵉ ligne. */
export function peutDefinir(role: UserRole): boolean {
  return peutDefinir2eLigne(role)
}

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  return { userId, userRole, orgId: scope.activeOrgId }
}

// GET /api/controles — bibliothèque de contrôles + échéance et efficacité.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ controles: [], active: false })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.controlePermanentActive) return NextResponse.json({ controles: [], active: false })

  const rows = await prisma.controle.findMany({
    where: { organizationId: orgId },
    orderBy: [{ actif: 'desc' }, { createdAt: 'desc' }],
    include: {
      processus: { select: { nom: true } },
      riskItem: { select: { intitule: true } },
      executions: { orderBy: { dateRealisation: 'desc' }, select: { id: true, resultat: true, dateRealisation: true, constat: true, preuves: true, checklistResultats: true } },
    },
  })

  const now = new Date()
  const controles = rows.map(({ processus, riskItem, executions, ...c }) => {
    const derniere = executions[0]?.dateRealisation ?? null
    const echeance = prochaineEcheance(c.periodicite as Periodicite, derniere, c.createdAt)
    return {
      ...c,
      processusNom: processus?.nom ?? null,
      riskItemIntitule: riskItem?.intitule ?? null,
      derniereExecution: derniere,
      prochaineEcheance: echeance,
      // Un contrôle inactif n'a pas d'échéance à honorer.
      etatEcheance: c.actif ? etatEcheance(echeance, now) : null,
      efficacite: evaluerEfficacite(executions),
      executions: executions.slice(0, 5),
      nbExecutions: executions.length,
    }
  })
  return NextResponse.json({ controles, active: true })
}

// POST /api/controles — créer un contrôle dans la bibliothèque (2ᵉ ligne).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!peutDefinir(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const cfg = await getOrgConfig(orgId)
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

  const controle = await prisma.controle.create({ data: { ...data, organizationId: orgId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'controle', action: 'create', id: controle.id },
  })
  return NextResponse.json(controle, { status: 201 })
}
