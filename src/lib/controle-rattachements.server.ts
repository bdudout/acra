// ─── Rattachements d'un contrôle (tiers, projet 360) — vérification serveur ──
// Les identifiants sont des liens logiques : on vérifie qu'ils appartiennent à l'organisation.

import { prisma } from '@/lib/prisma'
import { cleanRattachements, type Rattachements } from '@/lib/controle-l3b'

export type ResultatRattachements = { ok: true; data: Rattachements } | { ok: false; error: 'tiers_invalide' | 'projet_invalide' }

export async function verifierRattachements(body: Record<string, unknown>, orgId: string): Promise<ResultatRattachements> {
  const data = cleanRattachements(body)
  if (data.arrangementTicId) {
    const a = await prisma.arrangementTic.findFirst({ where: { id: data.arrangementTicId, organizationId: orgId }, select: { id: true } })
    if (!a) return { ok: false, error: 'tiers_invalide' }
  }
  if (data.projetId) {
    const p = await prisma.analyse.findFirst({ where: { id: data.projetId, organizationId: orgId, methode: 'PROJET_360', deletedAt: null }, select: { id: true } })
    if (!p) return { ok: false, error: 'projet_invalide' }
  }
  return { ok: true, data }
}
