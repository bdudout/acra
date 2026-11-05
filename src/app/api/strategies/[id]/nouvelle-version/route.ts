// ─── POST /api/strategies/[id]/nouvelle-version — copie une stratégie VALIDEE en BROUILLON (version + 1) — lot S1a ──
// Axes, objectifs et rattachements sont copiés sous verrou de la stratégie (plan chargé dans la transaction). La version
// copiée reste VALIDEE (référence) jusqu'à la validation de la copie, qui l'archive (route valider). Un seul brouillon
// de version par stratégie validée : 409 `version_en_cours` sinon (lot S1a-fix).
import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import { peutRedigerStrategie } from '@/lib/permissions'
import { planNouvelleVersion } from '@/lib/strategie'
import { chargerCadre, contexteStrategie, donneesIdentifiants, echec, sousVerrouStrategie, estRefus } from '@/lib/strategie.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const POST = withAccess(
  { org: 'active', allow: peutRedigerStrategie, rateLimit: { bucket: 'strategies' } },
  async (req, { user, role, orgId, params: { id } }) => {
    const c = await contexteStrategie(orgId, id)
    if ('erreur' in c) return c.erreur
    const r = await sousVerrouStrategie(orgId, id, async (tx, s) => {
      const plan = planNouvelleVersion({ ...s, axes: await chargerCadre(id, tx) }, user.id)
      if (!plan) return { erreur: echec(409, 'transition_invalide') }
      const enCours = await tx.strategie.findFirst({ where: { versionPrecedenteId: id, organizationId: orgId, statut: 'BROUILLON' }, select: { id: true } })
      if (enCours) return { erreur: echec(409, 'version_en_cours', { strategieId: enCours.id }) }
      const { referenceInterne, identifiantsExternes, ...champsStrategie } = plan.strategie
      const strategie = await tx.strategie.create({
        data: {
          ...champsStrategie,
          ...donneesIdentifiants({ referenceInterne, identifiantsExternes }),
          axes: {
            create: plan.axes.map(a => ({
              ordre: a.ordre, titre: a.titre, description: a.description, referenceRef: a.referenceRef,
              ...donneesIdentifiants(a),
              objectifs: { create: a.objectifs.map(({ referenceInterne: _r, identifiantsExternes: _i, ...o }) => ({ ...o, ...donneesIdentifiants({ referenceInterne: _r, identifiantsExternes: _i }) })) },
              rattachements: { create: a.rattachements.map(rt => ({ ...rt, organizationId: orgId })) },
            })),
          },
        },
      })
      return { strategie, version: plan.strategie.version }
    })
    if (estRefus(r)) return r.erreur
    await auditLog('STRATEGIE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie', targetId: r.strategie.id, details: { action: 'new_version', precedente: id, version: r.version } })
    return NextResponse.json({ strategie: r.strategie }, { status: 201 })
  },
)
