// POST : suivi d'une préconisation, même cycle que les constats d'audit (lib/audit-l4 appliquerSuivi) :
//  - DECLARER_REALISE, DEMANDER_REPORT : son responsable métier ou la 2ᵉ ligne ;
//  - VERIFIER (par une autre personne), REOUVRIR, DECIDER_REPORT : 2ᵉ ligne ;
//  - ACCEPTER_RISQUE { justification, lierConformite? } : son responsable ou la 2ᵉ ligne ; si l'exigence
//    est connue et lierConformite, crée un traitement « acceptation de risque » suivi dans la conformité.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { chargerPreconisation, refuse } from '@/lib/questionnaire.server'
import { appliquerSuivi, type SuiviCommande } from '@/lib/audit-l4'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await chargerPreconisation(id)
  if (!c.ctx) return c.response!
  const { ctx, preconisation: p } = c
  const estResponsable = p.responsableId === ctx.userId
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const now = new Date()

  if (body.action === 'ACCEPTER_RISQUE') {
    if (!estResponsable && !ctx.canDefine) return refuse(403, 'forbidden')
    if (p.statut !== 'OUVERT' && p.statut !== 'EN_COURS') return refuse(409, 'transition_interdite')
    const justification = typeof body.justification === 'string' ? body.justification.trim().slice(0, 4000) : ''
    if (!justification) return refuse(400, 'commentaire_requis')
    const lier = body.lierConformite === true && !!p.referentielCode && !!p.exigenceRef
    const traitementId = await prisma.$transaction(async tx => {
      const upd = await tx.preconisation.updateMany({ where: { id, statut: p.statut }, data: { statut: 'ACCEPTE', acceptationJustification: justification, accepteePar: ctx.userName, accepteeLe: now } })
      if (!upd.count) return null
      if (!lier) return ''
      const t = await tx.conformiteTraitement.create({ data: {
        organizationId: ctx.orgId, referentiel: p.referentielCode!, entite: '', refs: [p.exigenceRef!], type: 'ACCEPTATION_RISQUE', statut: 'ACTIVE',
        intitule: p.intitule.slice(0, 200), description: justification, responsable: ctx.userName.slice(0, 120), createdById: ctx.userId,
      }, select: { id: true } })
      return t.id
    })
    if (traitementId === null) return refuse(409, 'transition_interdite')
    await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'preconisation', action: 'accepter-risque', id, traitementId: traitementId || null } })
    return NextResponse.json({ ok: true, statut: 'ACCEPTE', traitementId: traitementId || null })
  }

  let cmd: SuiviCommande
  switch (body.action) {
    case 'DECLARER_REALISE': cmd = { action: 'DECLARER_REALISE' }; break
    case 'VERIFIER': cmd = { action: 'VERIFIER', commentaire: typeof body.commentaire === 'string' ? body.commentaire : undefined }; break
    case 'REOUVRIR': cmd = { action: 'REOUVRIR', commentaire: typeof body.commentaire === 'string' ? body.commentaire : '' }; break
    case 'DEMANDER_REPORT': cmd = { action: 'DEMANDER_REPORT', nouvelleEcheance: String(body.nouvelleEcheance ?? ''), motif: typeof body.motif === 'string' ? body.motif : '' }; break
    case 'DECIDER_REPORT': cmd = { action: 'DECIDER_REPORT', index: Number(body.index), decision: body.decision === 'APPROUVE' ? 'APPROUVE' : 'REFUSE' }; break
    default: return refuse(400, 'action_invalide')
  }
  if ((cmd.action === 'DECLARER_REALISE' || cmd.action === 'DEMANDER_REPORT') && !estResponsable && !ctx.canDefine) return refuse(403, 'forbidden')
  const res = appliquerSuivi(
    { statut: p.statut, echeance: p.echeance, echeanceInitiale: p.echeanceInitiale, reports: p.reports, realiseePar: p.realiseePar },
    cmd, { acteur: ctx.userName, auditeur: ctx.canDefine, now },
  )
  if (!res.ok) return refuse(res.error === 'role_audit_requis' ? 403 : 400, res.error)
  const upd = await prisma.preconisation.updateMany({ where: { id, statut: p.statut }, data: res.patch as never })
  if (!upd.count) return refuse(409, 'transition_interdite')
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'preconisation', action: cmd.action, id } })
  return NextResponse.json({ ok: true, ...res.patch })
}
