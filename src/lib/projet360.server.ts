// ─── Analyse projet 360 — population à partir des données existantes ─────────
// À la création d'un projet 360 : réponses du questionnaire pré-remplies d'après les
// données DÉJÀ présentes dans ACRA (analyses cyber, registre TIC, processus, registre
// RGPD, module DORA), puis création des risques proposés, sans doublon (règle déjà
// créée ou intitulé existant). Rien n'est inventé : une réponse « oui » a toujours
// une source, que l'utilisateur voit et confirme.

import { prisma } from './prisma'
import { getOrgConfig } from './org-config.server'
import { getEffectiveScaleConfig } from './configuration-server'
import { RISK_METHODS, METHOD_META } from './methodes'
import { sanitizeDirectRisque } from './risque-direct'
import { defaultAnswers360, planPopulation360, isDomaine360, type Faits360 } from './projet360'
import type { Translations } from './i18n'

const CYBER_METHODS = RISK_METHODS.filter(m => METHOD_META[m].cyber) as string[]

/** Comptages des données existantes de l'organisation utiles au questionnaire 360. */
export async function collectFaits360(orgId: string): Promise<Faits360> {
  const cfg = await getOrgConfig(orgId)
  const [analysesCyber, ticCritiques, ticCloud, processusCritiques, traitementsRgpd] = await Promise.all([
    prisma.analyse.count({ where: { organizationId: orgId, deletedAt: null, methode: { in: CYBER_METHODS } } }),
    prisma.arrangementTic.count({ where: { organizationId: orgId, criticite: { in: ['CRITIQUE', 'IMPORTANTE'] } } }),
    prisma.arrangementTic.count({ where: { organizationId: orgId, typeService: { in: ['CLOUD', 'HEBERGEMENT'] } } }),
    prisma.processus.count({ where: { organizationId: orgId, OR: [{ criticite: { gte: 3 } }, { criticiteDora: { in: ['CRITIQUE', 'IMPORTANTE'] } }] } }),
    prisma.traitement.count({ where: { organizationId: orgId } }),
  ])
  return { analysesCyber, ticCritiques, ticCloud, processusCritiques, traitementsRgpd, doraActif: cfg.reglementaireActive }
}

/** Peuple une analyse projet 360 : réponses pré-remplies (avec sources) + risques proposés. */
export async function populateProjet360(analyseId: string, orgId: string, t: Translations) {
  const [faits, cfg, analyse, scale] = await Promise.all([
    collectFaits360(orgId),
    getOrgConfig(orgId),
    prisma.analyse.findUnique({ where: { id: analyseId }, select: { qualification: true, risques: { select: { nom: true, qualificationRuleId: true } } } }),
    getEffectiveScaleConfig(orgId),
  ])
  if (!analyse) return { answers: 0, risks: 0 }
  const { answers, sources } = defaultAnswers360(faits)
  const base = analyse.qualification && typeof analyse.qualification === 'object' && !Array.isArray(analyse.qualification) ? analyse.qualification as Record<string, unknown> : {}
  await prisma.analyse.update({ where: { id: analyseId }, data: { qualification: { ...base, ...answers, 'p360._sources': sources } } })

  const catalog = {
    ...((t as { qualification?: { riskCatalog?: Record<string, { title: string; description?: string }> } }).qualification?.riskCatalog ?? {}),
    ...(t.projet360.riskCatalog as Record<string, { title: string; description?: string }>),
  }
  const plan = planPopulation360({
    answers, orgRules: cfg.qualificationQuestionnaire.riskRules ?? [], catalog,
    existingRuleIds: analyse.risques.flatMap(r => (r.qualificationRuleId ? [r.qualificationRuleId] : [])),
    existingTitles: analyse.risques.map(r => r.nom),
  })
  if (plan.length === 0) return { answers: Object.keys(answers).length, risks: 0 }
  const res = await prisma.risque.createMany({
    skipDuplicates: true,
    data: plan.map(p => {
      const r = sanitizeDirectRisque({ nom: p.title, description: p.description, gravite: p.gravity, vraisemblance: p.likelihood, strategie: p.strategy }, scale.nbNiveaux)
      const { vulnerabilites: _v, domaine: _d, ...row } = r
      void _v; void _d
      return { ...row, description: r.description ?? null, analyseId, qualificationRuleId: p.id, ...(isDomaine360(p.category) ? { domaine: p.category } : {}) }
    }),
  })
  return { answers: Object.keys(answers).length, risks: res.count }
}
