// ─── DELETE /api/strategies/[id]/rattachements/[rattachementId] — retire un rattachement (lot S1a) ──
// Après validation : justification obligatoire (corps JSON `{ justification }`) et historique.
import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import { peutRattacherStrategie } from '@/lib/permissions'
import { decisionRattachement, lireJustification } from '@/lib/strategie'
import { contexteStrategie, echec, historiser, sousVerrouStrategie, estRefus } from '@/lib/strategie.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const DELETE = withAccess(
  { org: 'active', allow: peutRattacherStrategie, rateLimit: { bucket: 'strategies' } },
  async (req, { user, role, orgId, params: { id, rattachementId } }) => {
    const c = await contexteStrategie(orgId, id)
    if ('erreur' in c) return c.erreur
    const corps = (await req.json().catch(() => ({}))) as { justification?: unknown }
    const justification = lireJustification(corps?.justification)
    const res = await sousVerrouStrategie(orgId, id, async (tx, s) => {
      const r = await tx.rattachementStrategique.findFirst({ where: { id: rattachementId, organizationId: orgId, axe: { strategieId: id } } })
      if (!r) return { erreur: echec(404, 'not_found') }
      const d = decisionRattachement(s.statut, justification)
      if (!d.ok) return { erreur: echec(d.status, d.error) }
      await tx.rattachementStrategique.delete({ where: { id: rattachementId } })
      if (d.historiser) await historiser(tx, { strategieId: id, organizationId: orgId, type: 'RETRAIT_RATTACHEMENT', cibleId: rattachementId, avant: { axeId: r.axeId, sourceType: r.sourceType, sourceId: r.sourceId, provenance: r.provenance }, justification: justification!, auteurId: user.id })
      return { historise: d.historiser }
    })
    if (estRefus(res)) return res.erreur
    await auditLog('STRATEGIE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie', targetId: id, details: { action: 'rattachement_delete', rattachementId, apresValidation: res.historise } })
    return NextResponse.json({ ok: true })
  },
)
