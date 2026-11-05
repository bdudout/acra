// ─── POST /api/strategies/[id]/valider — BROUILLON → VALIDEE, instantané immuable du cadre (lot S1a) ──
// Sous verrou de la stratégie : statut relu, instantané pris et statut basculé dans la même transaction. Si c'est la
// version suivante d'une stratégie VALIDEE, celle-ci passe ARCHIVEE dans cette même transaction (lot S1a-fix).
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { withAccess } from '@/lib/with-access.server'
import { peutValiderStrategie } from '@/lib/permissions'
import { instantaneCadre, transitionAutorisee } from '@/lib/strategie'
import { chargerCadre, contexteStrategie, echec, sousVerrouStrategie, estRefus } from '@/lib/strategie.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const POST = withAccess(
  { org: 'active', allow: peutValiderStrategie, rateLimit: { bucket: 'strategies' } },
  async (req, { user, role, orgId, params: { id } }) => {
    const c = await contexteStrategie(orgId, id)
    if ('erreur' in c) return c.erreur
    const valideeLe = new Date()
    const r = await sousVerrouStrategie(orgId, id, async (tx, s) => {
      if (!transitionAutorisee(s.statut, 'VALIDEE')) return { erreur: echec(409, 'transition_invalide') }
      const cadre = instantaneCadre(await chargerCadre(id, tx), s)
      const { count } = await tx.strategie.updateMany({
        where: { id, organizationId: orgId, statut: 'BROUILLON' },
        data: { statut: 'VALIDEE', valideePar: user.id, valideeLe, cadreValide: cadre as unknown as Prisma.InputJsonValue },
      })
      if (!count) return { erreur: echec(409, 'transition_invalide') }
      // La version précédente reste la référence jusqu'ici ; elle est archivée maintenant.
      const archivee = s.versionPrecedenteId
        ? (await tx.strategie.updateMany({ where: { id: s.versionPrecedenteId, organizationId: orgId, statut: 'VALIDEE' }, data: { statut: 'ARCHIVEE' } })).count > 0
        : false
      return { version: s.version, axes: cadre.axes.length, precedenteArchivee: archivee ? s.versionPrecedenteId : null }
    })
    if (estRefus(r)) return r.erreur
    const base = { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'strategie' }
    await auditLog('STRATEGIE_VALIDATED', { ...base, targetId: id, details: { action: 'validate', version: r.version, axes: r.axes } })
    if (r.precedenteArchivee) await auditLog('STRATEGIE_ARCHIVED', { ...base, targetId: r.precedenteArchivee, details: { action: 'archive', remplaceePar: id } })
    return NextResponse.json({ ok: true, statut: 'VALIDEE', valideeLe })
  },
)
