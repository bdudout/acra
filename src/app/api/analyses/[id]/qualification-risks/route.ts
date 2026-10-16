// ─── Risques proposés / imposés par la qualification d'une analyse ───────────
// GET  — propositions déclenchées par les réponses de qualification, traduites,
//        avec leur caractère imposé et leur état (déjà créées ou non).
// POST — crée la sélection + les risques IMPOSÉS (non décochables), en une seule
//        transaction, idempotent par règle (contrainte unique analyse × règle).
// EBIOS RM : les risques naissent en atelier 5 (état local de l'atelier, persisté
// par son auto-save) → POST refusé ici pour ne pas être écrasé par cet auto-save.
// Gardes : accès (404 sans divulgation), édition (403), gel après acceptation (403) —
// `withAccess` (mode analyse ; `write` pour le POST : rôle EFFECTIF de l'org de l'analyse).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { getServerT } from '@/lib/i18n'
import { sanitizeQualification, suggestedQualificationRisks } from '@/lib/qualification'
import { RISK_RULES_360, sanitizeAnswers360, isDomaine360 } from '@/lib/projet360'
import {
  localizeQualificationRisks, planQualificationRiskCreation, propositionsDejaPresentes, qualificationRiskChannel, type QualificationRiskCatalogTexts,
} from '@/lib/qualification-risks'
import { sanitizeDirectRisque } from '@/lib/risque-direct'
import { risquesSectorielsProposes } from '@/lib/risques-sectoriels-proposes'
import { getServerLocale } from '@/lib/i18n'
import { sousSecteursOf } from '@/lib/sous-secteurs'
import { patternsOf } from '@/lib/patterns-archi'

export const dynamic = 'force-dynamic'

/** Charge l'analyse (accès déjà vérifié par withAccess), ses propositions traduites et les règles déjà créées. */
async function load(id: string) {
  const analyse = await prisma.analyse.findFirst({
    where: { id },
    include: { risques: { select: { nom: true, qualificationRuleId: true } } },
  })
  if (!analyse) return { ok: false as const, res: NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 }) }
  const config = await getOrgConfig(analyse.organizationId)
  const t = await getServerT()
  // Analyse projet 360 : règles et catalogue 360 en plus de ceux de l'organisation.
  const is360 = analyse.methode === 'PROJET_360'
  const catalog: QualificationRiskCatalogTexts = {
    ...(((t as { qualification?: { riskCatalog?: QualificationRiskCatalogTexts } }).qualification?.riskCatalog) ?? {}),
    ...(is360 ? t.projet360.riskCatalog as QualificationRiskCatalogTexts : {}),
  }
  const questionnaire = config.qualificationQuestionnaire
  const answers = { ...sanitizeQualification(analyse.qualification, questionnaire), ...(is360 ? sanitizeAnswers360(analyse.qualification) : {}) }
  const rules = [...(questionnaire.riskRules ?? []), ...(is360 ? RISK_RULES_360 : [])]
  const qualifies = localizeQualificationRisks(suggestedQualificationRisks(answers, rules, analyse.methode), catalog)
  // Pack postal L4.1 : saisie directe → jusqu'à 5 suggestions sectorielles décochées, sans doublon d'intitulé.
  const sectoriels = qualificationRiskChannel(analyse.methode) === 'DIRECT'
    ? risquesSectorielsProposes({ secteur: analyse.secteur, sousSecteurs: sousSecteursOf(analyse), patterns: patternsOf(analyse), locale: await getServerLocale(), exclus: [...qualifies.map(p => p.title), ...analyse.risques.map(r => r.nom)] })
    : []
  const proposals = [...qualifies, ...sectoriels]
  // Déjà présentes : même règle, même intitulé ou risque par défaut équivalent → ni reproposées, ni recréées.
  const existingRuleIds = [...propositionsDejaPresentes(proposals, analyse.risques)]
  return { ok: true as const, analyse, config, proposals, existingRuleIds }
}

// GET /api/analyses/:id/qualification-risks
export const GET = withAccess({ org: { analyse: 'id' } }, async (_req, { analyse }) => {
  const ctx = await load(analyse.id)
  if (!ctx.ok) return ctx.res
  const existing = new Set(ctx.existingRuleIds)
  return NextResponse.json({
    channel: qualificationRiskChannel(ctx.analyse.methode),
    proposals: ctx.proposals.map(p => ({ ...p, alreadyCreated: existing.has(p.id) })),
  })
})

// POST /api/analyses/:id/qualification-risks — { ruleIds: string[] }
// Édition (403) et gel après acceptation (403 ANALYSE_GELEE) : withAccess (`write`).
export const POST = withAccess({ org: { analyse: 'id', write: true }, rateLimit: { bucket: 'qualification-risks' } }, async (req, { user, analyse: acces }) => {
  const ctx = await load(acces.id)
  if (!ctx.ok) return ctx.res
  const { analyse } = ctx
  const userId = user.id
  const role = user.role
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
        // Domaine du risque (projet 360) = catégorie de la règle, si c'est un domaine 360.
        ...(isDomaine360(p.category) ? { domaine: p.category } : {}),
      }
    }),
  }))

  await auditLog('WORKSHOP_SAVED', {
    userId, userRole: role, organizationId: analyse.organizationId, targetId: analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'qualification-risks', created: plan.toCreate.map(p => p.id), skipped: plan.skipped },
  })
  return NextResponse.json({ created: result.count, createdRuleIds: plan.toCreate.map(p => p.id), skipped: plan.skipped }, { status: 201 })
})
