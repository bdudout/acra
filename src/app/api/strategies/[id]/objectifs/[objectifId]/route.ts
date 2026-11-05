// ─── PATCH / DELETE /api/strategies/[id]/objectifs/[objectifId] — modifie / supprime un objectif (cadre) — lot S1a ──
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { peutRedigerStrategie } from '@/lib/permissions'
import { decisionModifCadre, extraireIdentifiants, lireJustification, objectifUpdateSchema } from '@/lib/strategie'
import { appliquerModification, contexteStrategie, echec, historiser, kriDeLOrg, objectifDeLaStrategie, sousVerrouStrategie, estRefus } from '@/lib/strategie.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const access = { org: 'active', allow: peutRedigerStrategie, rateLimit: { bucket: 'strategies' } } as const

export const PATCH = withAccess({ ...access, body: objectifUpdateSchema }, async (req, { user, role, orgId, params: { id, objectifId }, body }) => {
  const c = await contexteStrategie(orgId, id)
  if ('erreur' in c) return c.erreur
  const ex = extraireIdentifiants(body)
  if (!ex.ok) return echec(400, ex.error)
  const justification = lireJustification(body.justification)
  // Le KRI référencé doit appartenir à l'organisation (404 `kri_introuvable`, rien d'écrit).
  const kriId = ex.reste.kriId
  if (kriId && !(await kriDeLOrg(prisma, orgId, kriId))) return echec(404, 'kri_introuvable')
  const r = await appliquerModification({
    strategieId: id, organizationId: orgId, charger: tx => objectifDeLaStrategie(id, objectifId, tx), reste: ex.reste, ids: ex.ids,
    decisionReste: s => decisionModifCadre(s.statut, c.cfg.strategieCadreFige, justification), typeCadre: 'MODIF_OBJECTIF',
    cibleId: objectifId, auteurId: user.id, justification,
    ecrire: (tx, data) => tx.objectifStrategique.update({ where: { id: objectifId }, data }),
  })
  if (estRefus(r)) return r.erreur
  await auditLog('STRATEGIE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie', targetId: id, details: { action: 'objectif_update', objectifId, champs: [...Object.keys(ex.reste), ...Object.keys(ex.ids)], apresValidation: r.historise } })
  return NextResponse.json({ objectif: r.valeur })
})

export const DELETE = withAccess(access, async (req, { user, role, orgId, params: { id, objectifId } }) => {
  const c = await contexteStrategie(orgId, id)
  if ('erreur' in c) return c.erreur
  const corps = (await req.json().catch(() => ({}))) as { justification?: unknown }
  const justification = lireJustification(corps?.justification)
  const r = await sousVerrouStrategie(orgId, id, async (tx, s) => {
    const objectif = await objectifDeLaStrategie(id, objectifId, tx)
    if (!objectif) return { erreur: echec(404, 'not_found') }
    const d = decisionModifCadre(s.statut, c.cfg.strategieCadreFige, justification)
    if (!d.ok) return { erreur: echec(d.status, d.error) }
    await tx.objectifStrategique.delete({ where: { id: objectifId } })
    if (d.historiser) await historiser(tx, { strategieId: id, organizationId: orgId, type: 'SUPPR_OBJECTIF', cibleId: objectifId, avant: { titre: objectif.titre, axeId: objectif.axeId, indicateur: objectif.indicateur, cible: objectif.cible }, justification: justification!, auteurId: user.id })
    return { historise: d.historiser }
  })
  if (estRefus(r)) return r.erreur
  await auditLog('STRATEGIE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie', targetId: id, details: { action: 'objectif_delete', objectifId, apresValidation: r.historise } })
  return NextResponse.json({ ok: true })
})
