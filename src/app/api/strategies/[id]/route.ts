// ─── /api/strategies/[id] — détail, mise à jour (BROUILLON), suppression (BROUILLON) — lot S1a ──
import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import { peutRedigerStrategie, peutVoirStrategie } from '@/lib/permissions'
import { decisionModifStrategie, extraireIdentifiants, strategieUpdateSchema } from '@/lib/strategie'
import { appliquerModification, chargerCadre, contexteStrategie, echec, estRefus, sousVerrouStrategie } from '@/lib/strategie.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const GET = withAccess({ org: 'active', allow: peutVoirStrategie }, async (_req, { orgId, params: { id } }) => {
  const c = await contexteStrategie(orgId, id)
  if ('erreur' in c) return c.erreur
  return NextResponse.json({ strategie: { ...c.strategie, axes: await chargerCadre(id) }, cadreFige: c.cfg.strategieCadreFige })
})

export const PATCH = withAccess(
  { org: 'active', allow: peutRedigerStrategie, rateLimit: { bucket: 'strategies' }, body: strategieUpdateSchema },
  async (req, { user, role, orgId, params: { id }, body }) => {
    const c = await contexteStrategie(orgId, id)
    if ('erreur' in c) return c.erreur
    const ex = extraireIdentifiants(body)
    if (!ex.ok) return echec(400, ex.error)
    // Champs de la stratégie : BROUILLON seulement ; identifiants internes : modifiables après validation, tracés.
    // Statut et période relus sous verrou.
    const r = await appliquerModification({
      strategieId: id, organizationId: orgId, charger: async (_tx, s) => s, reste: ex.reste, ids: ex.ids,
      decisionReste: s => {
        const d = decisionModifStrategie(s.statut)
        if (!d.ok) return d
        const debut = body.periodeDebut !== undefined ? body.periodeDebut : s.periodeDebut
        const fin = body.periodeFin !== undefined ? body.periodeFin : s.periodeFin
        if (debut && fin && fin < debut) return { ok: false, reponse: echec(400, 'invalid_body', { fields: ['periodeFin'] }) }
        return d
      },
      typeCadre: null, cibleId: id, auteurId: user.id, justification: null,
      ecrire: (tx, data) => tx.strategie.update({ where: { id }, data }),
    })
    if (estRefus(r)) return r.erreur
    await auditLog('STRATEGIE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie', targetId: id, details: { action: 'update', champs: [...Object.keys(ex.reste), ...Object.keys(ex.ids)], apresValidation: r.historise } })
    return NextResponse.json({ strategie: r.valeur })
  },
)

export const DELETE = withAccess(
  { org: 'active', allow: peutRedigerStrategie, rateLimit: { bucket: 'strategies' } },
  async (req, { user, role, orgId, params: { id } }) => {
    const c = await contexteStrategie(orgId, id)
    if ('erreur' in c) return c.erreur
    const r = await sousVerrouStrategie(orgId, id, async (tx, s) => {
      const d = decisionModifStrategie(s.statut)
      if (!d.ok) return { erreur: echec(d.status, d.error) }
      await tx.strategie.delete({ where: { id } })
      return { ok: true as const }
    })
    if (estRefus(r)) return r.erreur
    await auditLog('STRATEGIE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie', targetId: id, details: { action: 'delete' } })
    return NextResponse.json({ ok: true })
  },
)
