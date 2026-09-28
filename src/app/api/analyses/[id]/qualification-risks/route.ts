import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { canEditAnalyse, resolveAnalyseRole, type UserRole } from '@/lib/permissions'
import { getOrgConfig } from '@/lib/org-config.server'
import { sanitizeQualification, suggestedQualificationRisks } from '@/lib/qualification'
import { sanitizeDirectRisque } from '@/lib/risque-direct'

type Params = { params: Promise<{ id: string }> }

/** Crée le sous-ensemble explicitement sélectionné de risques issus de la qualification. */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id; const role = ((session.user as { role?: UserRole }).role ?? 'ANALYSTE') as UserRole
  const { id } = await params
  const analyse = await prisma.analyse.findFirst({ where: await analyseAccessWhere(userId, role, id), include: { accesUtilisateurs: true, risques: { select: { nom: true } } } })
  if (!analyse) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })
  const effectiveRole = resolveAnalyseRole(role, analyse.organizationId, analyse.organizationId ? await getEffectiveRoleForOrg(userId, role, analyse.organizationId) : null)
  if (!canEditAnalyse({ id: userId, role: effectiveRole }, analyse)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const body = await req.json().catch(() => ({})); const selected = new Set(Array.isArray(body.ruleIds) ? body.ruleIds.filter((item: unknown) => typeof item === 'string') : [])
  const config = await getOrgConfig(analyse.organizationId)
  const proposals = suggestedQualificationRisks(sanitizeQualification(analyse.qualification, config.qualificationQuestionnaire), config.qualificationQuestionnaire.riskRules ?? [], analyse.methode)
  const existing = new Set(analyse.risques.map(risque => risque.nom.trim().toLowerCase()))
  const created = []
  for (const proposal of proposals) {
    if (!selected.has(proposal.id) || existing.has(proposal.title.trim().toLowerCase())) continue
    const risk = sanitizeDirectRisque({ nom: proposal.title, description: proposal.description, gravite: proposal.gravity, vraisemblance: proposal.likelihood, strategie: proposal.strategy })
    created.push(await prisma.risque.create({ data: { analyseId: analyse.id, nom: risk.nom, description: risk.description, gravite: risk.gravite, vraisemblance: risk.vraisemblance, niveauRisque: risk.niveauRisque, graviteActuelle: risk.graviteActuelle, vraisemblanceActuelle: risk.vraisemblanceActuelle, niveauActuel: risk.niveauActuel, graviteResiduelle: risk.graviteResiduelle, vraisemblanceResiduelle: risk.vraisemblanceResiduelle, niveauResiduel: risk.niveauResiduel, strategie: risk.strategie } }))
  }
  return NextResponse.json({ created: created.length })
}
