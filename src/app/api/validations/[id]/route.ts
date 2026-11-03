import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAccess } from '@/lib/with-access.server'
import { getClientIp } from '@/lib/logger'
import { trancherDemande } from '@/lib/double-validation.server'
import { MAX_MOTIF } from '@/lib/double-validation'

export const dynamic = 'force-dynamic'

const corps = z.object({ decision: z.enum(['APPROUVER', 'REJETER', 'ANNULER']), motif: z.string().max(MAX_MOTIF).optional().nullable() })

/**
 * POST /api/validations/[id] — trancher une demande de double validation : APPROUVER (exécute l'action), REJETER (motif
 * obligatoire), ANNULER (demandeur seulement). Le demandeur ne tranche jamais sa propre demande ; droit évalué dans
 * l'organisation de la demande (lib/double-validation.server).
 */
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'double-validation' }, body: corps }, async (req, { user, params, body }) => {
  const r = await trancherDemande({ demandeId: params.id, userId: user.id, instanceRole: user.role, decision: body.decision, motif: body.motif, ip: getClientIp(req) })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ ok: true, statut: r.statut })
})
