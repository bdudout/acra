import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere, getAccessibleOrgIds, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import {
  calcDateFin, canPreparerHomologation, etatValidite, isDecision, isHomologationStatut, sanitizeDuree,
  sanitizePieces, sanitizeReserves, validerTransition, type HomologationStatut, type PieceEtat,
} from '@/lib/homologation'
import { auditLog, getClientIp } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

const TRANSITION_STATUS: Record<string, number> = { transition_interdite: 409, role_interdit: 403, separation: 403, dossier_incomplet: 409, reserves_requises: 409 }

/** Homologation visible par l'utilisateur, module actif dans son organisation ; sinon réponse d'erreur. */
async function charger(userId: string, instanceRole: UserRole, id: string) {
  const h = await prisma.homologation.findUnique({ where: { id }, include: { analyse: { select: { nom: true } } } })
  if (!h) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const { all, ids } = await getAccessibleOrgIds(userId, instanceRole)
  if (!all && !ids.includes(h.organizationId)) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  if (!(await getOrgConfig(h.organizationId)).homologationsActive) return { error: NextResponse.json({ error: 'Module inactif' }, { status: 403 }) }
  // Rôle EFFECTIF dans l'organisation de l'homologation (pas le rôle d'instance).
  const role = ((await getEffectiveRoleForOrg(userId, instanceRole, h.organizationId)) ?? instanceRole) as UserRole
  return { h, role }
}

// GET /api/homologations/[id] — fiche (dossier, décision, état de validité).
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const r = await charger(userId, instanceRole, (await params).id)
  if ('error' in r) return r.error
  const { h, role } = r
  return NextResponse.json({ ...h, analyseNom: h.analyse?.nom ?? null, analyse: undefined, etat: etatValidite(h, new Date()), role })
}

// PATCH /api/homologations/[id] — { action: 'update', ... } (dossier, pendant l'instruction) ou
// { action: 'transition', to, commentaire?, reserves? } (cycle de vie, séparation préparateur / autorité).
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const { id } = await params
  const r = await charger(userId, instanceRole, id)
  if ('error' in r) return r.error
  const { h, role } = r
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const audit = (action: 'HOMOLOGATION_UPDATED' | 'HOMOLOGATION_TRANSITION', details: Record<string, unknown>) =>
    auditLog(action, { userId, userRole: role, targetId: id, targetType: 'homologation', ip: getClientIp(req), details: { systeme: h.systeme, ...details } })

  if (body.action === 'update') {
    if (!canPreparerHomologation(role)) return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
    if (h.statut !== 'PREPARATION' && h.statut !== 'COMMISSION') return NextResponse.json({ error: 'Dossier figé après décision (réexamen nécessaire)' }, { status: 409 })
    const data: Record<string, unknown> = {}
    if (typeof body.systeme === 'string') {
      const s = body.systeme.trim().slice(0, 200)
      if (!s) return NextResponse.json({ error: 'Le système à homologuer est requis' }, { status: 400 })
      data.systeme = s
    }
    if (body.perimetre !== undefined) data.perimetre = typeof body.perimetre === 'string' && body.perimetre.trim() ? body.perimetre.trim().slice(0, 2000) : null
    if (body.dureeMois !== undefined) data.dureeMois = sanitizeDuree(body.dureeMois)
    if (body.pieces !== undefined) data.pieces = sanitizePieces(body.pieces)
    if (body.autoriteId !== undefined) {
      if (body.autoriteId === null || body.autoriteId === '') data.autoriteId = null
      else {
        const autoriteId = String(body.autoriteId)
        // L'autorité est membre de l'organisation et n'est pas le préparateur.
        if (autoriteId === h.preparePar) return NextResponse.json({ error: 'Le préparateur ne peut pas être l’autorité' }, { status: 400 })
        const membre = await prisma.orgMembership.findFirst({ where: { userId: autoriteId, organizationId: h.organizationId }, select: { id: true } })
        if (!membre) return NextResponse.json({ error: 'Autorité introuvable dans l’organisation' }, { status: 400 })
        data.autoriteId = autoriteId
      }
    }
    if (body.analyseId !== undefined) {
      if (!body.analyseId) data.analyseId = null
      else {
        const a = await prisma.analyse.findFirst({ where: await analyseAccessWhere(userId, instanceRole, String(body.analyseId)), select: { id: true, organizationId: true, deletedAt: true } })
        if (!a || a.deletedAt || a.organizationId !== h.organizationId) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })
        data.analyseId = a.id
      }
    }
    const updated = await prisma.homologation.update({ where: { id }, data })
    await audit('HOMOLOGATION_UPDATED', { champs: Object.keys(data) })
    return NextResponse.json(updated)
  }

  if (body.action === 'transition') {
    if (!isHomologationStatut(body.to)) return NextResponse.json({ error: 'Statut inconnu' }, { status: 400 })
    const to: HomologationStatut = body.to
    const from = h.statut as HomologationStatut
    const reserves = sanitizeReserves(body.reserves)
    const res = validerTransition(
      { statut: from, preparePar: h.preparePar, autoriteId: h.autoriteId, pieces: sanitizePieces(h.pieces as unknown as PieceEtat[]) },
      to, { id: userId, role }, reserves,
    )
    if (!res.ok) return NextResponse.json({ error: res.code }, { status: TRANSITION_STATUS[res.code] ?? 409 })
    const commentaire = typeof body.commentaire === 'string' && body.commentaire.trim() ? body.commentaire.trim().slice(0, 5000) : null
    const now = new Date()
    const data: Record<string, unknown> = { statut: to }
    if (isDecision(to)) {
      Object.assign(data, {
        decidePar: userId, dateDecision: now, commentaireDecision: commentaire,
        dateFin: to === 'REFUSE' ? null : calcDateFin(now, h.dureeMois),
        reserves: to === 'HOMOLOGUE_RESERVES' ? reserves : [], rappelLe: null,
      })
    } else if (to === 'PREPARATION' && from !== 'COMMISSION') {
      // Réexamen : la décision précédente reste tracée au journal ; la fiche repart en instruction.
      Object.assign(data, { decidePar: null, dateDecision: null, dateFin: null, commentaireDecision: null, reserves: [], rappelLe: null })
    }
    const updated = await prisma.homologation.update({ where: { id }, data })
    await audit('HOMOLOGATION_TRANSITION', { de: from, vers: to, ...(commentaire ? { commentaire } : {}), ...(reserves.length && to === 'HOMOLOGUE_RESERVES' ? { reserves: reserves.length } : {}) })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
