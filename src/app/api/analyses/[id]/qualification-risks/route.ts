// ─── Risques proposés / imposés par la qualification d'une analyse ───────────
// GET  — propositions déclenchées par les réponses de qualification, traduites,
//        avec leur caractère imposé et leur état (déjà créées ou non).
// POST — crée la sélection + les risques IMPOSÉS (non décochables), en une seule
//        transaction, idempotent par règle (contrainte unique analyse × règle).
// EBIOS RM : les risques naissent en atelier 5 (état local de l'atelier, persisté
// par son auto-save) → POST refusé ici pour ne pas être écrasé par cet auto-save.
// Gardes : accès (404 sans divulgation), édition (403), gel après acceptation (403).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { canEditAnalyse, resolveAnalyseRole, type UserRole } from '@/lib/permissions'
import { getOrgConfig } from '@/lib/org-config.server'
import { analyseGelee } from '@/lib/gel-analyse'
import { auditLog, getClientIp } from '@/lib/logger'
import { getServerT } from '@/lib/i18n'
import { sanitizeQualification, suggestedQualificationRisks } from '@/lib/qualification'
import {
  localizeQualificationRisks, planQualificationRiskCreation, qualificationRiskChannel, type QualificationRiskCatalogTexts,
} from '@/lib/qualification-risks'
import { sanitizeDirectRisque } from '@/lib/risque-direct'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

/** Charge l'analyse accessible, ses propositions traduites et les règles déjà créées. */
async function load(id: string) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) return { ok: false as const, res: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const role = (user.role ?? 'ANALYSTE') as UserRole
  const analyse = await prisma.analyse.findFirst({
    where: await analyseAccessWhere(user.id, role, id),
    include: { accesUtilisateurs: true, risques: { select: { qualificationRuleId: true } } },
  })
  if (!analyse || analyse.deletedAt) return { ok: false as const, res: NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 }) }
  const config = await getOrgConfig(analyse.organizationId)
  const t = await getServerT()
  const catalog = ((t as { qualification?: { riskCatalog?: QualificationRiskCatalogTexts } }).qualification?.riskCatalog) ?? {}
  const questionnaire = config.qualificationQuestionnaire
  const proposals = localizeQualificationRisks(
    suggestedQualificationRisks(sanitizeQualification(analyse.qualification, questionnaire), questionnaire.riskRules ?? [], analyse.methode),
    catalog,
  )
  const existingRuleIds = analyse.risques.flatMap(r => (r.qualificationRuleId ? [r.qualificationRuleId] : []))
  return { ok: true as const, userId: user.id, role, analyse, config, proposals, existingRuleIds }
}

// GET /api/analyses/:id/qualification-risks
export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await load((await params).id)
  if (!ctx.ok) return ctx.res
  const existing = new Set(ctx.existingRuleIds)
  return NextResponse.json({
    channel: qualificationRiskChannel(ctx.analyse.methode),
    proposals: ctx.proposals.map(p => ({ ...p, alreadyCreated: existing.has(p.id) })),
  })
}

// POST /api/analyses/:id/qualification-risks — { ruleIds: string[] }
export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await load((await params).id)
  if (!ctx.ok) return ctx.res
  const { analyse, userId, role } = ctx
  const effRole = resolveAnalyseRole(role, analyse.organizationId, analyse.organizationId ? await getEffectiveRoleForOrg(userId, role, analyse.organizationId) : null)
  if (!canEditAnalyse({ id: userId, role: effRole }, analyse)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  if (analyseGelee(analyse.risquesResiduelsStatut, ctx.config.gelApresAcceptationActive)) {
    return NextResponse.json({ error: 'ANALYSE_GELEE' }, { status: 403 })
  }
  if (qualificationRiskChannel(analyse.methode) === 'ATELIER5') {
    return NextResponse.json({ error: 'ebios_via_atelier5' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const selectedIds = Array.isArray(body?.ruleIds) ? body.ruleIds.filter((x: unknown): x is string => typeof x === 'string').slice(0, 200) : []
  const plan = planQualificationRiskCreation({ proposals: ctx.proposals, selectedIds, existingRuleIds: ctx.existingRuleIds })

  // Atomique ; skipDuplicates couvre la course entre deux validations simultanées
  // (contrainte unique analyse × règle) sans jamais créer de doublon.
  const result = plan.toCreate.length === 0 ? { count: 0 } : await prisma.$transaction(tx => tx.risque.createMany({
    skipDuplicates: true,
    data: plan.toCreate.map(p => {
      const r = sanitizeDirectRisque({ nom: p.title, description: p.description, gravite: p.gravity, vraisemblance: p.likelihood, strategie: p.strategy })
      return {
        analyseId: analyse.id, qualificationRuleId: p.id, nom: r.nom, description: r.description,
        gravite: r.gravite, vraisemblance: r.vraisemblance, niveauRisque: r.niveauRisque,
        graviteActuelle: r.graviteActuelle, vraisemblanceActuelle: r.vraisemblanceActuelle, niveauActuel: r.niveauActuel,
        graviteResiduelle: r.graviteResiduelle, vraisemblanceResiduelle: r.vraisemblanceResiduelle, niveauResiduel: r.niveauResiduel,
        strategie: r.strategie,
      }
    }),
  }))

  await auditLog('WORKSHOP_SAVED', {
    userId, userRole: role, organizationId: analyse.organizationId, targetId: analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'qualification-risks', created: plan.toCreate.map(p => p.id), skipped: plan.skipped },
  })
  return NextResponse.json({ created: result.count, createdRuleIds: plan.toCreate.map(p => p.id), skipped: plan.skipped }, { status: 201 })
}
