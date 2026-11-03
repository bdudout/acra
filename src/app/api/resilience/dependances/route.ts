import { NextResponse } from 'next/server'
import { withAccess } from '@/lib/with-access.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { hasGlobalReadDispositif, peutGererRegistreTic, type UserRole } from '@/lib/permissions'
import { analyserDependances } from '@/lib/dependances-critiques'
import { chargerFonctionsCritiques } from '@/lib/dependances-critiques.server'

export const dynamic = 'force-dynamic'
const lecture = (role: UserRole) => peutGererRegistreTic(role) || hasGlobalReadDispositif(role)

/**
 * GET /api/resilience/dependances — cartographie des dépendances des fonctions critiques ou importantes (DORA) de
 * l'organisation active : délais, dépendances TIC (usages, points d'accès), contrôles, risques, incidents des 12 derniers
 * mois, écarts et concentration (lib/dependances-critiques). Module réglementaire actif ; lecture de la gouvernance.
 */
export const GET = withAccess({ org: 'active', allow: lecture }, async (_req, { orgId, role }) => {
  if (!(await getOrgConfig(orgId)).reglementaireActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })
  const { fonctions, scenariosDetail } = await chargerFonctionsCritiques(orgId)
  return NextResponse.json({ ...analyserDependances(fonctions), scenariosDetail, peutModifier: peutGererRegistreTic(role) })
})
