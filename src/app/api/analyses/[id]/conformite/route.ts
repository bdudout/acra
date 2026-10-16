import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { lockCadrageOfAnalyse } from '@/lib/row-lock.server'
import { isAdminRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import {
  sanitizeConformite,
  applyConformiteEntry,
  missingExclusionJustifications,
  conformiteStats,
  CONFORMITE_STATUTS,
  type ConformiteStatut,
} from '@/lib/conformite'
import { getFrameworkControles } from '@/lib/frameworks-data'
import { getServerLocale } from '@/lib/i18n'
import { getOrgConfig } from '@/lib/org-config.server'

/**
 * PATCH /api/analyses/[id]/conformite
 *
 * Met à jour le statut d'UN contrôle du socle de sécurité (Cadrage.socleSecurite)
 * sans passer par l'atelier 1 — pour l'édition inline depuis le dashboard (suivi de
 * conformité). Body : { ref: string, statut: 'conforme'|'partiel'|'non_conforme'|'na' }.
 *
 * Requiert : session valide (401), accès à l'analyse (404), droit d'ÉDITION sur le rôle
 * EFFECTIF de l'org de l'analyse (F01, 403) et analyse non gelée (403) — `withAccess`
 * en mode écriture —, sous rate-limit écriture (429), conformité activée pour l'org
 * (403), analyse non approuvée sauf ADMIN (403), et un cadrage existant (400). Ne
 * touche que le champ socleSecurite (fusion par ref). Renvoie les statistiques de
 * conformité à jour.
 */
export const PATCH = withAccess(
  { org: { analyse: 'id', write: true }, rateLimit: { bucket: 'conformite' } },
  async (req, { role: effRole, analyse: acces }) => {
    const analyseId = acces.id
    const analyse = await prisma.analyse.findFirst({
      where: { id: analyseId },
      select: { referentielMesures: true, cadrage: { select: { socleSecurite: true, customControles: true } } },
    })
    if (!analyse) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

    // Cohérence : refuser l'édition si la fonctionnalité conformité est désactivée pour l'org.
    const orgConfig = await getOrgConfig(acces.organizationId)
    if (!orgConfig.conformiteActive) {
      return NextResponse.json({ error: 'Fonctionnalité de conformité désactivée' }, { status: 403 })
    }
    if (acces.statut === 'APPROUVE' && !isAdminRole(effRole)) {
      return NextResponse.json({ error: 'L\'analyse est approuvée et ne peut plus être modifiée' }, { status: 403 })
    }
    if (!analyse.cadrage) return NextResponse.json({ error: 'Cadrage inexistant' }, { status: 400 })

    const body = await req.json().catch(() => null)
    const ref = String(body?.ref ?? '').trim()
    const statut = body?.statut as ConformiteStatut
    if (!ref || !(CONFORMITE_STATUTS as string[]).includes(statut)) {
      return NextResponse.json({ error: 'Requête invalide (ref/statut)' }, { status: 400 })
    }

    const locale = await getServerLocale()
    const ref_ = analyse.referentielMesures ?? 'ISO27001'
    const controles = getFrameworkControles(ref_, (analyse.cadrage as any).customControles as any[], locale)
    const validRefs = new Set(controles.map(c => c.ref))
    // Refuser un contrôle inexistant dans le référentiel (defense-in-depth).
    if (!validRefs.has(ref)) return NextResponse.json({ error: 'Contrôle inconnu du référentiel' }, { status: 400 })

    // Fusion sous verrou de ligne (audit 2026-09-30, D2) : relecture du socle à jour.
    const updated = await prisma.$transaction(async tx => {
      await lockCadrageOfAnalyse(tx, analyseId)
      const fresh = await tx.cadrage.findUnique({ where: { analyseId }, select: { socleSecurite: true } })
      const current = sanitizeConformite(fresh?.socleSecurite, validRefs)
      const next = applyConformiteEntry(current, ref, { statut, commentaire: typeof body.commentaire === 'string' ? body.commentaire : undefined })
      if (missingExclusionJustifications(next.filter(e => e.ref === ref)).length) return null
      await tx.cadrage.update({ where: { analyseId }, data: { socleSecurite: next as unknown as object } })
      return next
    })
    if (!updated) return NextResponse.json({ error: 'NA_JUSTIFICATION_REQUIRED' }, { status: 400 })
    await prisma.analyse.update({ where: { id: analyseId }, data: { updatedAt: new Date() } })

    return NextResponse.json({ ok: true, stats: conformiteStats(updated, controles.length) })
  },
)
