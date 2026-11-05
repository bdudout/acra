// ─── PATCH / DELETE /api/strategies/[id]/axes/[axeId] — modifie / supprime un axe (cadre) — lot S1a ──
import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import { peutRedigerStrategie } from '@/lib/permissions'
import { axeUpdateSchema, decisionModifCadre, decisionSuppressionAxe, extraireIdentifiants, lireJustification } from '@/lib/strategie'
import { appliquerModification, axeDeLaStrategie, contexteStrategie, echec, historiser, sousVerrouStrategie, estRefus } from '@/lib/strategie.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const access = { org: 'active', allow: peutRedigerStrategie, rateLimit: { bucket: 'strategies' } } as const

export const PATCH = withAccess({ ...access, body: axeUpdateSchema }, async (req, { user, role, orgId, params: { id, axeId }, body }) => {
  const c = await contexteStrategie(orgId, id)
  if ('erreur' in c) return c.erreur
  const ex = extraireIdentifiants(body)
  if (!ex.ok) return echec(400, ex.error)
  const justification = lireJustification(body.justification)
  const r = await appliquerModification({
    strategieId: id, organizationId: orgId, charger: tx => axeDeLaStrategie(id, axeId, tx), reste: ex.reste, ids: ex.ids,
    decisionReste: s => decisionModifCadre(s.statut, c.cfg.strategieCadreFige, justification), typeCadre: 'MODIF_AXE',
    cibleId: axeId, auteurId: user.id, justification,
    ecrire: (tx, data) => tx.axeStrategique.update({ where: { id: axeId }, data }),
  })
  if (estRefus(r)) return r.erreur
  await auditLog('STRATEGIE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie', targetId: id, details: { action: 'axe_update', axeId, champs: [...Object.keys(ex.reste), ...Object.keys(ex.ids)], apresValidation: r.historise } })
  return NextResponse.json({ axe: r.valeur })
})

export const DELETE = withAccess(access, async (req, { user, role, orgId, params: { id, axeId } }) => {
  const c = await contexteStrategie(orgId, id)
  if ('erreur' in c) return c.erreur
  const corps = (await req.json().catch(() => ({}))) as { justification?: unknown }
  const justification = lireJustification(corps?.justification)
  // Sous verrou : après validation, un axe non vide (objectifs ou rattachements) n'est pas supprimable (409 `axe_non_vide`).
  const r = await sousVerrouStrategie(orgId, id, async (tx, s) => {
    const axe = await axeDeLaStrategie(id, axeId, tx)
    if (!axe) return { erreur: echec(404, 'not_found') }
    const [nbObjectifs, nbRattachements] = s.statut === 'BROUILLON' ? [0, 0] : await Promise.all([
      tx.objectifStrategique.count({ where: { axeId } }),
      tx.rattachementStrategique.count({ where: { axeId } }),
    ])
    const d = decisionSuppressionAxe(s.statut, c.cfg.strategieCadreFige, justification, nbObjectifs + nbRattachements > 0)
    if (!d.ok) return { erreur: echec(d.status, d.error) }
    await tx.axeStrategique.delete({ where: { id: axeId } })
    if (d.historiser) await historiser(tx, { strategieId: id, organizationId: orgId, type: 'SUPPR_AXE', cibleId: axeId, avant: { titre: axe.titre, description: axe.description, ordre: axe.ordre, referenceRef: axe.referenceRef }, justification: justification!, auteurId: user.id })
    return { historise: d.historiser }
  })
  if (estRefus(r)) return r.erreur
  await auditLog('STRATEGIE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie', targetId: id, details: { action: 'axe_delete', axeId, apresValidation: r.historise } })
  return NextResponse.json({ ok: true })
})
