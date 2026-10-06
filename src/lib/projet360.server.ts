// ─── Analyse projet 360 — population à partir des données existantes ─────────
// À la création d'un projet 360 : réponses du questionnaire pré-remplies d'après les
// données DÉJÀ présentes dans ACRA (analyses cyber, registre TIC, processus, registre
// RGPD, module DORA), puis création des risques proposés, sans doublon (règle déjà
// créée ou intitulé existant). Rien n'est inventé : une réponse « oui » a toujours
// une source, que l'utilisateur voit et confirme.

import { createAnalyseRiskPlanAction } from '@/lib/plan-action.server'
import { planSocle, reglesEquivalentesSocle, risquesSocle, sanitizeSocleConfig } from '@/lib/projet360-socle'
import type { Locale } from '@/lib/i18n'
import { prisma } from './prisma'
import { getOrgConfig } from './org-config.server'
import { getEffectiveScaleConfig } from './configuration-server'
import { RISK_METHODS, METHOD_META } from './methodes'
import { sanitizeDirectRisque } from './risque-direct'
import { defaultAnswers360, planPopulation360, isDomaine360, type Faits360 } from './projet360'
import { patternsOf } from './patterns-archi'
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
export async function populateProjet360(analyseId: string, orgId: string, t: Translations, locale: Locale = 'fr') {
  const [faits, cfg, analyse, scale] = await Promise.all([
    collectFaits360(orgId),
    getOrgConfig(orgId),
    prisma.analyse.findUnique({ where: { id: analyseId }, select: { qualification: true, patternsArchi: true, risques: { select: { nom: true, qualificationRuleId: true } } } }),
    getEffectiveScaleConfig(orgId),
  ])
  if (!analyse) return { answers: 0, risks: 0 }
  const { answers, sources } = defaultAnswers360({ ...faits, patterns: patternsOf(analyse) })
  const base = analyse.qualification && typeof analyse.qualification === 'object' && !Array.isArray(analyse.qualification) ? analyse.qualification as Record<string, unknown> : {}
  await prisma.analyse.update({ where: { id: analyseId }, data: { qualification: { ...base, ...answers, 'p360._sources': sources } } })

  const catalog = {
    ...((t as { qualification?: { riskCatalog?: Record<string, { title: string; description?: string }> } }).qualification?.riskCatalog ?? {}),
    ...(t.projet360.riskCatalog as Record<string, { title: string; description?: string }>),
  }
  // Risques présents par défaut dans tout projet (configuration de l'organisation), sans doublon ; ils priment sur les
  // risques équivalents du questionnaire (qui ne sont alors pas créés en double).
  const existingRuleIds = analyse.risques.flatMap(r => (r.qualificationRuleId ? [r.qualificationRuleId] : []))
  const socle = planSocle(
    risquesSocle(sanitizeSocleConfig(cfg.risquesProjetDefaut), locale, scale.nbNiveaux),
    existingRuleIds,
    analyse.risques.map(r => r.nom),
  )
  const plan = planPopulation360({
    answers, orgRules: cfg.qualificationQuestionnaire.riskRules ?? [], catalog,
    existingRuleIds: [...existingRuleIds, ...reglesEquivalentesSocle([...existingRuleIds, ...socle.map(s => s.ruleId)])],
    existingTitles: [...analyse.risques.map(r => r.nom), ...socle.map(s => s.nom)],
  })
  const socleCount = socle.length === 0 ? 0 : (await prisma.risque.createMany({
    skipDuplicates: true,
    data: socle.map(s => {
      const r = sanitizeDirectRisque({ nom: s.nom, gravite: s.gravite, vraisemblance: s.vraisemblance, strategie: 'REDUIRE' }, scale.nbNiveaux)
      const { vulnerabilites: _v, domaine: _d, ...row } = r
      void _v; void _d
      return { ...row, description: null, analyseId, qualificationRuleId: s.ruleId, ...(s.domaine ? { domaine: s.domaine } : {}) }
    }),
  })).count
  // Mesure (à mettre en œuvre) et plan d'action par défaut de chaque risque par défaut : le dispositif attendu et la
  // démarche à mener avec l'expert compétent.
  const outilles = socle.filter(s => s.plan || s.mesure)
  if (socleCount && outilles.length) {
    const crees = await prisma.risque.findMany({ where: { analyseId, qualificationRuleId: { in: outilles.map(s => s.ruleId) } }, select: { id: true, nom: true, qualificationRuleId: true } })
    const mesures = crees.flatMap(r => {
      const m = outilles.find(s => s.ruleId === r.qualificationRuleId)?.mesure
      return m ? [{ analyseId, risqueId: r.id, nom: m.nom, type: m.type, statut: 'A_FAIRE' as const }] : []
    })
    if (mesures.length) await prisma.mesure.createMany({ data: mesures })
    for (const r of crees) {
      const p = outilles.find(s => s.ruleId === r.qualificationRuleId)?.plan
      if (p) await createAnalyseRiskPlanAction(prisma, { organizationId: orgId, analyseId, risqueId: r.id, riskLabel: r.nom, titre: p.titre, description: p.description, statut: 'A_FAIRE', priorite: 'MAJEUR' })
    }
  }
  if (plan.length === 0) return { answers: Object.keys(answers).length, risks: socleCount }
  const res = await prisma.risque.createMany({
    skipDuplicates: true,
    data: plan.map(p => {
      const r = sanitizeDirectRisque({ nom: p.title, description: p.description, gravite: p.gravity, vraisemblance: p.likelihood, strategie: p.strategy }, scale.nbNiveaux)
      const { vulnerabilites: _v, domaine: _d, ...row } = r
      void _v; void _d
      return { ...row, description: r.description ?? null, analyseId, qualificationRuleId: p.id, ...(isDomaine360(p.category) ? { domaine: p.category } : {}) }
    }),
  })
  return { answers: Object.keys(answers).length, risks: res.count + socleCount }
}
