// ─── Modèles de questionnaire (2ᵉ ligne) ─────────────────────────────────────
// GET : modèles de l'organisation. POST : création, soit à partir de questions saisies
// (mode QUESTIONNAIRE), soit générée depuis les exigences choisies d'un référentiel (mode EXIGENCES).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { getServerLocale, getServerT } from '@/lib/i18n'
import { getExigencesFor } from '@/lib/referentiel.server'
import { questionnaireContext, refuse } from '@/lib/questionnaire.server'
import { questionsDepuisExigences, sanitizeQuestions } from '@/lib/questionnaire'

export const dynamic = 'force-dynamic'

const txt = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export async function GET(): Promise<NextResponse> {
  const r = await questionnaireContext()
  if (!r.ok) return r.response
  if (!r.ctx.canDefine) return refuse(403, 'forbidden')
  const modeles = await prisma.questionnaireModele.findMany({ where: { organizationId: r.ctx.orgId }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ modeles })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const r = await questionnaireContext()
  if (!r.ok) return r.response
  const { ctx } = r
  if (!ctx.canDefine) return refuse(403, 'forbidden')
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const titre = txt(body.titre, 200)
  if (!titre) return refuse(400, 'titre_requis')
  let questions = sanitizeQuestions(body.questions)
  let referentielCode: string | null = null
  const mode = body.mode === 'EXIGENCES' ? 'EXIGENCES' : 'QUESTIONNAIRE'
  if (mode === 'EXIGENCES') {
    referentielCode = txt(body.referentielCode, 80)
    if (!referentielCode) return refuse(400, 'referentiel_requis')
    const exigences = await getExigencesFor(referentielCode, ctx.orgId, await getServerLocale())
    const choisies = new Set(Array.isArray(body.exigenceRefs) ? body.exigenceRefs.filter((x): x is string => typeof x === 'string') : [])
    const retenues = exigences.filter(e => choisies.has(e.ref))
    if (!retenues.length) return refuse(400, 'exigences_requises')
    const t = await getServerT()
    questions = questionsDepuisExigences(referentielCode, retenues.slice(0, 100), e => t.questionnaires.questionExigence.replace('{ref}', e.ref).replace('{nom}', e.nom))
  }
  if (!questions.length) return refuse(400, 'questions_requises')
  const modele = await prisma.questionnaireModele.create({ data: {
    organizationId: ctx.orgId, titre, description: txt(body.description, 4000), mode, referentielCode, questions: questions as object[], createdById: ctx.userId,
  } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'questionnaire', action: 'modele-create', id: modele.id, questions: questions.length } })
  return NextResponse.json({ modele }, { status: 201 })
}
