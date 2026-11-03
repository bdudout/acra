// ─── Risques proposés depuis le registre TIC et la résilience (lot L4) ───────────────────────────────────────────────
// GET  : propositions ouvertes de l'organisation active, libellées dans la langue de l'utilisateur.
// POST : { cle, action: 'VALIDER' | 'ECARTER' } — valider crée le risque au registre (org active), écarter mémorise
//        la clé. Clé non ouverte dans l'organisation (inconnue, autre org, déjà traitée) → 404 sans divulgation ;
//        validée ou écartée entre-temps (course) → 409.
// Droit : peutTraiterPropositionsRisquesTic (création au registre + lecture du registre TIC) ; modules registre des
// risques ET réglementaire actifs. Calcul : lib/propositions-risques-tic (pur), accès base : *.server.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAccess } from '@/lib/with-access.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { getClientIp } from '@/lib/logger'
import { getServerT } from '@/lib/i18n'
import { peutTraiterPropositionsRisquesTic, peutVoirPropositionsRisquesTic } from '@/lib/permissions'
import { estClePropositionTic, libellerProposition } from '@/lib/propositions-risques-tic'
import { ecarterPropositionTic, propositionsOuvertesOrg, validerPropositionTic } from '@/lib/propositions-risques-tic.server'

export const dynamic = 'force-dynamic'

const corps = z.object({
  cle: z.string().refine(estClePropositionTic),
  action: z.enum(['VALIDER', 'ECARTER']),
})

async function modulesActifs(orgId: string): Promise<boolean> {
  const c = await getOrgConfig(orgId)
  return !!c.registreRisquesActive && !!c.reglementaireActive
}
const inactif = () => NextResponse.json({ error: 'module_inactive' }, { status: 403 })
const echec = (status: 404 | 409) => NextResponse.json({ error: status === 409 ? 'conflict' : 'not_found' }, { status })

export const GET = withAccess({ org: 'active', allow: peutVoirPropositionsRisquesTic }, async (_req, { orgId, role }) => {
  if (!(await modulesActifs(orgId))) return inactif()
  const [props, t] = await Promise.all([propositionsOuvertesOrg(orgId), getServerT()])
  return NextResponse.json({
    propositions: props.map(p => ({ ...p, ...libellerProposition(p, t) })),
    peutTraiter: peutTraiterPropositionsRisquesTic(role),
  })
})

export const POST = withAccess(
  { org: 'active', allow: peutTraiterPropositionsRisquesTic, rateLimit: { bucket: 'risk-items' }, body: corps },
  async (req, { user, role, orgId, body }) => {
    if (!(await modulesActifs(orgId))) return inactif()
    const acteur = { orgId, cle: body.cle, userId: user.id, role, ip: getClientIp(req) }
    if (body.action === 'ECARTER') {
      const r = await ecarterPropositionTic(acteur)
      return r.ok ? NextResponse.json(r.value) : echec(r.status)
    }
    const r = await validerPropositionTic(acteur, await getServerT())
    return r.ok ? NextResponse.json(r.value, { status: 201 }) : echec(r.status)
  },
)
