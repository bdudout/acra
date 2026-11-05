// ─── POST /api/strategies/[id]/axes/[axeId]/objectifs — ajoute un objectif à un axe (cadre) — lot S1a ──
import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import { peutRedigerStrategie } from '@/lib/permissions'
import { decisionModifCadre, extraireIdentifiants, lireJustification, objectifSchema } from '@/lib/strategie'
import { axeDeLaStrategie, contexteStrategie, donneesIdentifiants, echec, historiser, kriDeLOrg, sousVerrouStrategie, estRefus } from '@/lib/strategie.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const POST = withAccess(
  { org: 'active', allow: peutRedigerStrategie, rateLimit: { bucket: 'strategies' }, body: objectifSchema },
  async (req, { user, role, orgId, params: { id, axeId }, body }) => {
    const c = await contexteStrategie(orgId, id)
    if ('erreur' in c) return c.erreur
    const ex = extraireIdentifiants(body)
    if (!ex.ok) return echec(400, ex.error)
    const champs = ex.reste
    const justification = lireJustification(body.justification)
    const r = await sousVerrouStrategie(orgId, id, async (tx, s) => {
      if (!(await axeDeLaStrategie(id, axeId, tx))) return { erreur: echec(404, 'not_found') }
      const d = decisionModifCadre(s.statut, c.cfg.strategieCadreFige, justification)
      if (!d.ok) return { erreur: echec(d.status, d.error) }
      // Le KRI référencé doit appartenir à l'organisation.
      if (champs.kriId && !(await kriDeLOrg(tx, orgId, champs.kriId))) return { erreur: echec(404, 'kri_introuvable') }
      const o = await tx.objectifStrategique.create({ data: { ...champs, ...donneesIdentifiants(ex.ids), titre: body.titre, echeance: champs.echeance ?? null, axeId } })
      if (d.historiser) await historiser(tx, { strategieId: id, organizationId: orgId, type: 'AJOUT_OBJECTIF', cibleId: o.id, apres: { ...champs, ...ex.ids, axeId }, justification: justification!, auteurId: user.id })
      return { objectif: o, historise: d.historiser }
    })
    if (estRefus(r)) return r.erreur
    const { objectif } = r
    await auditLog('STRATEGIE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie', targetId: id, details: { action: 'objectif_create', objectifId: objectif.id, apresValidation: r.historise } })
    return NextResponse.json({ objectif }, { status: 201 })
  },
)
