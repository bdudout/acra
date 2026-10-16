import { missingExclusionJustifications } from '@/lib/conformite'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { lockConformite, ensureConformiteRow } from '@/lib/row-lock.server'
import { getAnalyseScope } from '@/lib/org-context.server'
import { canReadOrgResource, peutGererConformite } from '@/lib/permissions'
import { requireSession } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import {
  sanitizeConformite, applyConformiteEntry, conformiteStats,
  CONFORMITE_STATUTS, CONFORMITE_TRAITEMENTS, type ConformiteStatut, type ConformiteTraitement,
} from '@/lib/conformite'
import { getOrgConfig } from '@/lib/org-config.server'
import { shouldSnapshotOnChange, usesConformiteEntity } from '@/lib/conformite-config'
import { getExigencesFor } from '@/lib/referentiel.server'
import { getServerLocale } from '@/lib/i18n'
import { auditLog, getClientIp } from '@/lib/logger'

/** Écritures : rôle EFFECTIF de gouvernance (dont CONFORMITE et DPO) dans l'org CIBLE (A01/CWE-863). */
const GESTION = { org: { param: 'orgId' }, allow: peutGererConformite, rateLimit: { bucket: 'org-conformite' } } as const

/** Discriminant de suivi : "" = suivi org-wide ; sinon libellé d'entité/socle. */
function cleanEntite(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, 80) : ''
}

/** Contrôle commun des éditions : feature active, conformité portée au niveau organisation, référentiel connu. */
async function preparer(req: Request, orgId: string) {
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.conformiteActive) return { error: NextResponse.json({ error: 'Conformité désactivée' }, { status: 403 }) }
  if (!usesConformiteEntity(orgConfig.conformiteNiveau)) return { error: NextResponse.json({ error: 'Conformité non portée au niveau organisation' }, { status: 409 }) }

  const body = await req.json().catch(() => null)
  const referentiel = String(body?.referentiel ?? '').trim()
  if (!referentiel || referentiel === 'CUSTOM') {
    return { error: NextResponse.json({ error: 'Référentiel invalide' }, { status: 400 }) }
  }
  // Suivi ciblé : "" (org-wide) ou un libellé d'entité/socle (multi-suivis).
  const entite = cleanEntite(body?.entite)
  return { orgConfig, body, referentiel, entite }
}

/** Récupère (et crée si besoin) le SUIVI Conformite (organisation × référentiel × entité), tolérant aux créations concurrentes. */
async function getOrCreate(orgId: string, referentiel: string, entite: string) {
  const { id } = await ensureConformiteRow(orgId, referentiel, entite)
  return prisma.conformite.findUniqueOrThrow({ where: { id }, select: { id: true, entries: true } })
}

/**
 * PATCH /api/organizations/[orgId]/conformite — met à jour le statut d'un contrôle
 * de la conformité de référence de l'organisation. Body { referentiel, ref, statut }.
 * Crée un snapshot si le mode est CHANGEMENT. Renvoie les stats à jour.
 */
export const PATCH = withAccess(GESTION, async (req, { user: { id: userId }, orgId }) => {
  const g = await preparer(req, orgId)
  if (g.error) return g.error
  const { body, referentiel, entite, orgConfig } = g

  const ref = String(body?.ref ?? '').trim()
  const statut = body?.statut as ConformiteStatut
  if (!ref || !(CONFORMITE_STATUTS as string[]).includes(statut)) {
    return NextResponse.json({ error: 'Requête invalide (ref/statut)' }, { status: 400 })
  }
  // Commentaire et traitement de l'écart (optionnels). `null` = retrait explicite.
  const commentaire = typeof body?.commentaire === 'string' ? body.commentaire
    : body?.commentaire === null ? null : undefined
  const traitement = (CONFORMITE_TRAITEMENTS as string[]).includes(body?.traitement) ? body.traitement as ConformiteTraitement
    : body?.traitement === null ? null : undefined
  const locale = await getServerLocale()
  const controles = await getExigencesFor(referentiel, orgId, locale)
  if (!new Set(controles.map(c => c.ref)).has(ref)) {
    return NextResponse.json({ error: 'Contrôle inconnu du référentiel' }, { status: 400 })
  }

  const conf = await getOrCreate(orgId, referentiel, entite)
  // Fusion sous verrou de ligne (audit 2026-09-30, D2) : relecture de la valeur à jour,
  // sinon deux éditions concurrentes de deux points différents s'écrasent.
  const result = await prisma.$transaction(async tx => {
    await lockConformite(tx, conf.id)
    const fresh = await tx.conformite.findUniqueOrThrow({ where: { id: conf.id }, select: { entries: true } })
    const updated = applyConformiteEntry(sanitizeConformite(fresh.entries), ref, { statut, commentaire, traitement })
    if (missingExclusionJustifications(updated.filter(e => e.ref === ref)).length) return null
    await tx.conformite.update({ where: { id: conf.id }, data: { entries: updated as unknown as object } })
    if (shouldSnapshotOnChange(orgConfig.conformiteSnapshotMode)) {
      await tx.conformiteSnapshot.create({ data: { conformiteId: conf.id, entries: updated as unknown as object, createdById: userId } })
    }
    return updated
  })
  if (!result) return NextResponse.json({ error: 'NA_JUSTIFICATION_REQUIRED' }, { status: 400 })
  return NextResponse.json({ ok: true, stats: conformiteStats(result, controles.length) })
})

/**
 * POST /api/organizations/[orgId]/conformite — fige une version (snapshot) de la
 * conformité de référence courante. Body { referentiel, label? }. Mode MANUEL.
 */
export const POST = withAccess(GESTION, async (req, { user: { id: userId }, orgId }) => {
  const g = await preparer(req, orgId)
  if (g.error) return g.error
  const { body, referentiel, entite } = g

  const conf = await getOrCreate(orgId, referentiel, entite)
  const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 120) || null : null
  const snap = await prisma.conformiteSnapshot.create({
    data: { conformiteId: conf.id, entries: sanitizeConformite(conf.entries) as unknown as object, label, createdById: userId },
    select: { id: true, createdAt: true, label: true },
  })
  return NextResponse.json({ ok: true, snapshot: snap })
})

/**
 * DELETE /api/organizations/[orgId]/conformite?referentiel=X&entite=Y — ARRÊTE le
 * suivi de conformité (supprime le suivi + ses snapshots par cascade). Réservé aux
 * rôles de gouvernance ; sans effet si le suivi n'existe pas.
 */
export const DELETE = withAccess(GESTION, async (req, { user, role, orgId }) => {

  const sp = new URL(req.url).searchParams
  const referentiel = (sp.get('referentiel') ?? '').trim()
  const entite = cleanEntite(sp.get('entite'))
  if (!referentiel || referentiel === 'CUSTOM') return NextResponse.json({ error: 'Référentiel invalide' }, { status: 400 })

  const { count } = await prisma.conformite.deleteMany({ where: { organizationId: orgId, referentiel, entite } })
  if (count) await auditLog('CONFORMITE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'conformite', details: { action: 'suivi-delete', referentiel, entite } })
  return NextResponse.json({ ok: true })
})

/**
 * GET /api/organizations/[orgId]/conformite?referentiel=ISO27001 — état courant +
 * historique des snapshots (avec taux calculé). Lecture : utilisateur authentifié
 * dont le périmètre couvre l'organisation.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const g = await requireSession()
  if (g.error) return g.error
  const scope = await getAnalyseScope(g.user.id, g.user.role)
  if (!canReadOrgResource(orgId, scope.scope)) {
    return NextResponse.json({ error: 'Organisation hors périmètre' }, { status: 403 })
  }

  const sp = new URL(req.url).searchParams
  const referentiel = sp.get('referentiel') ?? ''
  const entite = cleanEntite(sp.get('entite'))
  if (!referentiel || referentiel === 'CUSTOM') {
    return NextResponse.json({ error: 'Référentiel invalide' }, { status: 400 })
  }
  const locale = await getServerLocale()
  const total = (await getExigencesFor(referentiel, orgId, locale)).length

  const conf = await prisma.conformite.findUnique({
    where: { organizationId_referentiel_entite: { organizationId: orgId, referentiel, entite } },
    select: {
      id: true, entries: true, updatedAt: true,
      snapshots: { orderBy: { createdAt: 'asc' }, select: { id: true, label: true, createdAt: true, entries: true } },
    },
  })
  if (!conf) return NextResponse.json({ current: null, snapshots: [], entries: [] })

  const pointOf = (entries: unknown, at: Date, id: string, label: string | null) => {
    const s = conformiteStats(sanitizeConformite(entries), total)
    return { id, label, createdAt: at, taux: s.tauxConformite, evalues: s.evalues, total: s.total }
  }
  return NextResponse.json({
    current: pointOf(conf.entries, conf.updatedAt, conf.id, null),
    snapshots: conf.snapshots.map(s => pointOf(s.entries, s.createdAt, s.id, s.label)),
    // Entrées brutes (par contrôle) pour hydrater l'éditeur de socle.
    entries: sanitizeConformite(conf.entries),
  })
}
