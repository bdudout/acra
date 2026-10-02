import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { getServerLocale } from '@/lib/i18n'
import { type UserRole } from '@/lib/permissions'
import { getExigencesFor } from '@/lib/referentiel.server'
import { evaluerEfficacite } from '@/lib/controle'
import { nonConformitesExigences } from '@/lib/questionnaire'
import { synthetiserCouverture, croiserApplicationsAnalyses, type ControleCouvrant, type ConstatExigence } from '@/lib/couverture-referentiel'

export const dynamic = 'force-dynamic'

// GET /api/referentiels/couverture?code=ISO27001 — conformité DÉRIVÉE : statut de
// chaque exigence à partir des contrôles réels qui la couvrent et des constats.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ active: false })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ active: false })

  const code = new URL(req.url).searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'code_requis' }, { status: 400 })
  const locale = await getServerLocale()

  const [exigences, controleRows, constatRows, precoRows, envoiRows, analyseRows] = await Promise.all([
    getExigencesFor(code, orgId, locale),
    prisma.controle.findMany({
      where: { organizationId: orgId, referentielCode: code },
      select: { exigenceRefs: true, actif: true, executions: { select: { resultat: true, dateRealisation: true } } },
    }),
    prisma.auditConstat.findMany({
      where: { organizationId: orgId, referentielCode: code },
      select: { exigenceRef: true, statut: true },
    }),
    // Contrôle permanent : préconisations ouvertes et réponses de questionnaires revues non conformes.
    prisma.preconisation.findMany({ where: { organizationId: orgId, referentielCode: code }, select: { exigenceRef: true, statut: true, reponseId: true, questionId: true } }),
    prisma.questionnaireEnvoi.findMany({ where: { organizationId: orgId, statut: 'OUVERT' }, select: { questions: true, reponses: { where: { statut: 'REVUE' }, select: { id: true, statut: true, reponses: true } } } }),
    // Jointure visible : analyses de risques appliquant ce référentiel (socle).
    prisma.analyse.findMany({
      where: { organizationId: orgId },
      select: { id: true, nom: true, cadrage: { select: { referentiels: true } } },
    }),
  ])

  const controles: ControleCouvrant[] = controleRows.map(c => ({
    exigenceRefs: Array.isArray(c.exigenceRefs) ? (c.exigenceRefs as string[]) : [],
    efficacite: evaluerEfficacite(c.executions).efficacite,
    actif: c.actif,
  }))
  // Une réponse non conforme déjà reprise par une préconisation est suivie via cette préconisation.
  const reprises = new Set(precoRows.filter(p => p.reponseId && p.questionId).map(p => `${p.reponseId}|${p.questionId}`))
  const ncQuestionnaires = nonConformitesExigences(envoiRows, reprises)
  const constats: ConstatExigence[] = [
    ...constatRows.map(c => ({ exigenceRef: c.exigenceRef, statut: c.statut })),
    ...precoRows.map(p => ({ exigenceRef: p.exigenceRef, statut: p.statut, origine: 'CONTROLE' as const })),
    ...ncQuestionnaires.filter(n => n.referentielCode === code).map(n => ({ exigenceRef: n.ref, statut: 'OUVERT', origine: 'CONTROLE' as const })),
  ]

  const cov = synthetiserCouverture(exigences.map(e => ({ ref: e.ref })), controles, constats)
  const nomByRef = new Map(exigences.map(e => [e.ref, e.nom]))
  const parExigence = cov.parExigence.map(e => ({ ...e, nom: nomByRef.get(e.ref) ?? e.ref }))

  const application = croiserApplicationsAnalyses(
    analyseRows.map(a => ({ id: a.id, nom: a.nom, referentiels: a.cadrage?.referentiels ?? [] })),
    code,
  )

  return NextResponse.json({ active: true, code, parExigence, synthese: cov.synthese, application })
}
