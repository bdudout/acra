// ─── POST /api/strategies/[id]/rattachements — rattache un élément du store d'actions à un axe (lot S1a) ──
// Autorisé quel que soit le figeage du cadre, sauf stratégie ARCHIVEE ; après validation : justification + historique.
// La source doit exister DANS l'organisation et être visible du demandeur (404 `source_introuvable` sinon).
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { withAccess } from '@/lib/with-access.server'
import { peutRattacherStrategie } from '@/lib/permissions'
import { decisionRattachement, lireJustification, rattachementSchema } from '@/lib/strategie'
import { axeDeLaStrategie, contexteStrategie, echec, historiser, sourceExisteDansOrg, sousVerrouStrategie, estRefus } from '@/lib/strategie.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const POST = withAccess(
  { org: 'active', allow: peutRattacherStrategie, rateLimit: { bucket: 'strategies' }, body: rattachementSchema },
  async (req, { user, role, orgId, scope, params: { id }, body }) => {
    const c = await contexteStrategie(orgId, id)
    if ('erreur' in c) return c.erreur
    if (!(await axeDeLaStrategie(id, body.axeId))) return echec(404, 'not_found')
    const justification = lireJustification(body.justification)
    // Pré-contrôle (évite le chargement du store d'actions si refus évident) ; la décision fait foi sous verrou.
    const pre = decisionRattachement(c.strategie.statut, justification)
    if (!pre.ok) return echec(pre.status, pre.error)
    if (!(await sourceExisteDansOrg(orgId, c.cfg, { userId: user.id, role, scope }, body.sourceType, body.sourceId))) return echec(404, 'source_introuvable')
    try {
      const res = await sousVerrouStrategie(orgId, id, async (tx, s) => {
        if (!(await axeDeLaStrategie(id, body.axeId, tx))) return { erreur: echec(404, 'not_found') }
        const d = decisionRattachement(s.statut, justification)
        if (!d.ok) return { erreur: echec(d.status, d.error) }
        const r = await tx.rattachementStrategique.create({
          data: { organizationId: orgId, axeId: body.axeId, sourceType: body.sourceType, sourceId: body.sourceId, provenance: body.provenance, ajoutePar: user.id },
        })
        if (d.historiser) await historiser(tx, { strategieId: id, organizationId: orgId, type: 'AJOUT_RATTACHEMENT', cibleId: r.id, apres: { axeId: body.axeId, sourceType: body.sourceType, sourceId: body.sourceId, provenance: body.provenance }, justification: justification!, auteurId: user.id })
        return { rattachement: r, historise: d.historiser }
      })
      if (estRefus(res)) return res.erreur
      const { rattachement } = res
      await auditLog('STRATEGIE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie', targetId: id, details: { action: 'rattachement_create', axeId: body.axeId, sourceType: body.sourceType, sourceId: body.sourceId, apresValidation: res.historise } })
      return NextResponse.json({ rattachement }, { status: 201 })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return echec(409, 'deja_rattache')
      throw e
    }
  },
)
