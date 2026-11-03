import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import { canAdminInstance } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { verifierJournal } from '@/lib/audit-chaine.server'

export const dynamic = 'force-dynamic'
const superAdmin = { org: 'none', allow: (role: Parameters<typeof canAdminInstance>[0]['role']) => canAdminInstance({ id: '', role }), rateLimit: { bucket: 'audit-integrite' } } as const

/**
 * POST /api/admin/audit-log/integrite — vérifie toute la chaîne du journal d'audit (super-administrateur) : intègre ou
 * première rupture (numéro, nature), entrées non scellées, clé de chaînage configurée. La vérification est journalisée.
 */
export const POST = withAccess(superAdmin, async (req, { user }) => {
  const etat = await verifierJournal()
  await auditLog('AUDIT_INTEGRITE_VERIFIEE', { userId: user.id, userRole: user.role, ip: getClientIp(req), details: { ok: etat.ok, verifiees: etat.verifiees, rupture: etat.rupture ?? undefined } })
  return NextResponse.json(etat)
})
