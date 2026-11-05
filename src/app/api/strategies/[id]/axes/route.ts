// ─── POST /api/strategies/[id]/axes — ajoute un axe (cadre : figé ou justifié après validation) — lot S1a ──
import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import { peutRedigerStrategie } from '@/lib/permissions'
import { axeSchema, decisionModifCadre, extraireIdentifiants, lireJustification } from '@/lib/strategie'
import { contexteStrategie, donneesIdentifiants, echec, historiser, sousVerrouStrategie, estRefus } from '@/lib/strategie.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const POST = withAccess(
  { org: 'active', allow: peutRedigerStrategie, rateLimit: { bucket: 'strategies' }, body: axeSchema },
  async (req, { user, role, orgId, params: { id }, body }) => {
    const c = await contexteStrategie(orgId, id)
    if ('erreur' in c) return c.erreur
    const ex = extraireIdentifiants(body)
    if (!ex.ok) return echec(400, ex.error)
    const champs = ex.reste
    const justification = lireJustification(body.justification)
    // Décision sur le statut relu sous verrou de la stratégie.
    const r = await sousVerrouStrategie(orgId, id, async (tx, s) => {
      const d = decisionModifCadre(s.statut, c.cfg.strategieCadreFige, justification)
      if (!d.ok) return { erreur: echec(d.status, d.error) }
      const a = await tx.axeStrategique.create({ data: { ...champs, ...donneesIdentifiants(ex.ids), titre: body.titre, ordre: champs.ordre ?? 0, strategieId: id } })
      if (d.historiser) await historiser(tx, { strategieId: id, organizationId: orgId, type: 'AJOUT_AXE', cibleId: a.id, apres: { ...champs, ...ex.ids }, justification: justification!, auteurId: user.id })
      return { axe: a, historise: d.historiser }
    })
    if (estRefus(r)) return r.erreur
    const { axe } = r
    await auditLog('STRATEGIE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie', targetId: id, details: { action: 'axe_create', axeId: axe.id, apresValidation: r.historise } })
    return NextResponse.json({ axe }, { status: 201 })
  },
)
