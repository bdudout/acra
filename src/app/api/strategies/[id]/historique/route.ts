// ─── GET /api/strategies/[id]/historique — évolutions après validation, écart cadre validé ↔ courant (lot S1a) ──
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { peutVoirStrategie } from '@/lib/permissions'
import { ecartCadre, lireInstantane, rattachementsDepuisValidation } from '@/lib/strategie'
import { chargerCadre, contexteStrategie, nomsUtilisateurs } from '@/lib/strategie.server'

export const dynamic = 'force-dynamic'

export const GET = withAccess({ org: 'active', allow: peutVoirStrategie }, async (_req, { orgId, params: { id } }) => {
  const c = await contexteStrategie(orgId, id)
  if ('erreur' in c) return c.erreur
  const [cadre, evolutions] = await Promise.all([
    chargerCadre(id),
    prisma.strategieEvolution.findMany({ where: { strategieId: id, organizationId: orgId }, orderBy: { createdAt: 'asc' } }),
  ])
  const valide = lireInstantane(c.strategie.cadreValide)
  const noms = await nomsUtilisateurs([c.strategie.valideePar, ...evolutions.map(e => e.auteurId)])
  return NextResponse.json({
    statut: c.strategie.statut,
    version: c.strategie.version,
    valideePar: c.strategie.valideePar,
    valideeParNom: c.strategie.valideePar ? noms[c.strategie.valideePar] ?? null : null,
    valideeLe: c.strategie.valideeLe,
    cadreValide: valide,
    ecart: ecartCadre(valide, cadre),
    rattachementsDepuisValidation: rattachementsDepuisValidation(cadre.flatMap(a => a.rattachements), c.strategie.valideeLe),
    evolutions: evolutions.map(e => ({ ...e, auteurNom: e.auteurId ? noms[e.auteurId] ?? null : null })),
  })
})
