// ─── Questionnaires de contrôle : contexte serveur commun ─────────────────────
// Session → organisation active → module « contrôle permanent » actif → rôle EFFECTIF.
// canDefine (2ᵉ ligne, peutDefinir2eLigne) : modèles, envois, revue, préconisations.
// Tout compte non LECTEUR de l'organisation peut être répondant (1ʳᵉ ligne / métier).
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { getAnalyseScope } from './org-context.server'
import { getOrgConfig } from './org-config.server'
import { peutDefinir2eLigne, type UserRole } from './permissions'

export type QuestionnaireContext = { userId: string; userName: string; role: UserRole; orgId: string; canDefine: boolean }

export async function questionnaireContext(): Promise<{ ok: true; ctx: QuestionnaireContext } | { ok: false; response: NextResponse }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId || !scope.role) return { ok: false, response: NextResponse.json({ error: 'organization_required' }, { status: 400 }) }
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.controlePermanentActive) return { ok: false, response: NextResponse.json({ error: 'module_inactive' }, { status: 403 }) }
  return {
    ok: true,
    ctx: {
      userId, userName: session.user.name ?? session.user.email ?? userId, role: scope.role, orgId: scope.activeOrgId,
      canDefine: peutDefinir2eLigne(scope.role, { secondeLigneActive: cfg.secondeLigneActive }),
    },
  }
}

export const refuse = (status: 400 | 403 | 404 | 409, error: string) => NextResponse.json({ error }, { status })

/**
 * Comptes pouvant répondre pour l'organisation : membres directs et membres d'un ancêtre avec une
 * portée « sous-arbre ». Les lecteurs (lecture seule) ne répondent pas.
 */
export async function repondantsPossibles(orgId: string): Promise<{ id: string; name: string | null; email: string }[]> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { path: true } })
  const ancetres = (org?.path ?? '').split('/').filter(id => id && id !== orgId)
  const rows = await prisma.orgMembership.findMany({
    where: { role: { not: 'LECTEUR' }, OR: [{ organizationId: orgId }, ...(ancetres.length ? [{ organizationId: { in: ancetres }, scope: 'SUBTREE' as const }] : [])] },
    select: { user: { select: { id: true, name: true, email: true } } },
  })
  const byId = new Map(rows.map(r => [r.user.id, r.user]))
  return [...byId.values()].sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email))
}

/** Réponse de l'organisation active, visible de son répondant ou de la 2ᵉ ligne (sinon 404 sans divulgation). */
export async function chargerReponse(id: string) {
  const r = await questionnaireContext()
  if (!r.ok) return { response: r.response }
  const reponse = await prisma.questionnaireReponse.findFirst({ where: { id, organizationId: r.ctx.orgId }, include: { envoi: true } })
  // Hors périmètre (autre répondant sans droit 2ᵉ ligne) : 404, sans révéler l'existence.
  if (!reponse || (reponse.repondantId !== r.ctx.userId && !r.ctx.canDefine)) return { response: refuse(404, 'not_found') }
  return { ctx: r.ctx, reponse }
}

/** Préconisation de l'organisation active, visible de la 2ᵉ ligne ou de son responsable (sinon 404). */
export async function chargerPreconisation(id: string) {
  const r = await questionnaireContext()
  if (!r.ok) return { response: r.response }
  const preconisation = await prisma.preconisation.findFirst({ where: { id, organizationId: r.ctx.orgId } })
  if (!preconisation || (!r.ctx.canDefine && preconisation.responsableId !== r.ctx.userId)) return { response: refuse(404, 'not_found') }
  return { ctx: r.ctx, preconisation }
}
