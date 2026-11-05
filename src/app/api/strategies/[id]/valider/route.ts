// ─── POST /api/strategies/[id]/valider — BROUILLON → VALIDEE, instantané immuable du cadre (lot S1a) ──
// Sous verrou de la stratégie : statut relu, instantané pris et statut basculé dans la même transaction. Si c'est la
// version suivante d'une stratégie VALIDEE, celle-ci passe ARCHIVEE dans cette même transaction (lot S1a-fix), après
// report sur l'axe de même titre des rattachements qui lui ont été ajoutés ou retirés depuis l'ouverture du brouillon
// (lot S1b) : axe absent → signalé (`rattachementsNonReportes` / `retraitsNonReportes`) ; doublon → ignoré ; copie
// rajoutée depuis dans le brouillon → retrait non reporté, signalé. Verrous : N+1 (sousVerrouStrategie) puis N, toujours
// dans cet ordre. `valideeLe` est pris après le report : les copies ne passent pas pour des ajouts postérieurs.
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { withAccess } from '@/lib/with-access.server'
import { peutValiderStrategie } from '@/lib/permissions'
import { instantaneCadre, lireInstantane, planReportRattachements, transitionAutorisee, type PlanReport } from '@/lib/strategie'
import { chargerCadre, contexteStrategie, echec, historiser, sousVerrouStrategie, estRefus } from '@/lib/strategie.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const POST = withAccess(
  { org: 'active', allow: peutValiderStrategie, rateLimit: { bucket: 'strategies' } },
  async (req, { user, role, orgId, params: { id } }) => {
    const c = await contexteStrategie(orgId, id)
    if ('erreur' in c) return c.erreur
    const r = await sousVerrouStrategie(orgId, id, async (tx, s) => {
      if (!transitionAutorisee(s.statut, 'VALIDEE')) return { erreur: echec(409, 'transition_invalide') }
      let nonReportes: PlanReport['nonReportes'] = []
      let retraitsNonReportes: PlanReport['retraitsNonReportes'] = []
      // Verrou de la version N (après celui de N+1), relu sous verrou : seule une N encore VALIDEE est reportée puis archivée.
      const verrouN = s.versionPrecedenteId
        ? await tx.$queryRaw<{ id: string; statut: string }[]>`SELECT id, statut FROM "Strategie" WHERE id = ${s.versionPrecedenteId} AND "organizationId" = ${orgId} FOR UPDATE`
        : []
      const precedente = verrouN.length && verrouN[0].statut === 'VALIDEE'
        ? await tx.strategie.findFirst({ where: { id: verrouN[0].id, organizationId: orgId }, select: { id: true, cadreValide: true } })
        : null
      if (precedente) {
        const [cadreN, cadreN1, evolutionsN] = [
          await chargerCadre(precedente.id, tx), await chargerCadre(id, tx),
          await tx.strategieEvolution.findMany({ where: { strategieId: precedente.id, organizationId: orgId, type: 'RETRAIT_RATTACHEMENT' } }),
        ]
        // Titre de l'axe d'un retrait : cadre courant de N, sinon instantané validé (axe supprimé depuis).
        const titres = new Map<string, string>([
          ...(lireInstantane(precedente.cadreValide)?.axes ?? []).map(a => [a.id, a.titre] as [string, string]),
          ...cadreN.map(a => [a.id, a.titre] as [string, string]),
        ])
        const retraits = evolutionsN.flatMap(e => {
          const av = (e.avant ?? {}) as { axeId?: unknown; sourceType?: unknown; sourceId?: unknown }
          if (typeof av.sourceType !== 'string' || typeof av.sourceId !== 'string') return []
          const axeTitre = typeof av.axeId === 'string' ? titres.get(av.axeId) ?? null : null
          return [{ axeTitre, sourceType: av.sourceType, sourceId: av.sourceId, justification: e.justification, createdAt: e.createdAt }]
        })
        const plan = planReportRattachements(cadreN, cadreN1, s.createdAt, retraits)
        for (const rt of plan.aCreer) await tx.rattachementStrategique.create({ data: { ...rt, organizationId: orgId } })
        for (const rt of plan.aSupprimer) {
          await tx.rattachementStrategique.delete({ where: { id: rt.id } })
          await historiser(tx, { strategieId: id, organizationId: orgId, type: 'RETRAIT_RATTACHEMENT', cibleId: rt.id, avant: { axeId: rt.axeId, sourceType: rt.sourceType, sourceId: rt.sourceId }, justification: rt.justification, auteurId: user.id })
        }
        nonReportes = plan.nonReportes
        retraitsNonReportes = plan.retraitsNonReportes
      }
      const valideeLe = new Date()
      const cadre = instantaneCadre(await chargerCadre(id, tx), s)
      const { count } = await tx.strategie.updateMany({
        where: { id, organizationId: orgId, statut: 'BROUILLON' },
        data: { statut: 'VALIDEE', valideePar: user.id, valideeLe, cadreValide: cadre as unknown as Prisma.InputJsonValue },
      })
      if (!count) return { erreur: echec(409, 'transition_invalide') }
      // La version précédente reste la référence jusqu'ici ; elle est archivée maintenant.
      const archivee = precedente
        ? (await tx.strategie.updateMany({ where: { id: precedente.id, organizationId: orgId, statut: 'VALIDEE' }, data: { statut: 'ARCHIVEE' } })).count > 0
        : false
      return { version: s.version, axes: cadre.axes.length, precedenteArchivee: archivee && precedente ? precedente.id : null, nonReportes, retraitsNonReportes, valideeLe }
    })
    if (estRefus(r)) return r.erreur
    const base = { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie' }
    await auditLog('STRATEGIE_VALIDATED', { ...base, targetId: id, details: { action: 'validate', version: r.version, axes: r.axes } })
    if (r.precedenteArchivee) await auditLog('STRATEGIE_ARCHIVED', { ...base, targetId: r.precedenteArchivee, details: { action: 'archive', remplaceePar: id, rattachementsNonReportes: r.nonReportes.length, retraitsNonReportes: r.retraitsNonReportes.length } })
    return NextResponse.json({ ok: true, statut: 'VALIDEE', valideeLe: r.valideeLe, rattachementsNonReportes: r.nonReportes, retraitsNonReportes: r.retraitsNonReportes })
  },
)
