// ─── GET /api/actions — vue unifiée des plans d'action (page /actions), paginée côté serveur (lot V1) ──
// Même périmètre que la page : organisation active, ou bilan consolidé en lecture pour le SUPER_ADMIN sans
// organisation focalisée (resolvePageOrganizationIds) ; modules actifs par organisation ; accès fin aux analyses
// et liens selon le rôle (gatherActionItems).
//  • sans `page` : toutes les actions `{ items }` ;
//  • `?page=&taille=&tri=&ordre=&q=` + `origine`, `priorite` (code ou 1/2/3), `statut`, `echeance` (ou `filtre=retard`),
//    `porteur`, `entite`/`sousEntites`, `col` (filtres de colonne JSON), `categorie`, `axe` (lot S2)
//    → `{ items, pagination, synthese, valeurs, axes, rattachement }`. `rattachement` : menu « Rattacher à un axe »
//    (rôle `peutRattacherStrategie`, module Stratégie actif, organisation active explicite ; sinon `possible: false`).
// Les actions sont des projections légères (aucune relation chargée) : la page est découpée après filtre et tri.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { getAnalyseScope } from '@/lib/org-context.server'
import { resolvePageOrganizationIds } from '@/lib/org-context'
import { getOrgConfig } from '@/lib/org-config.server'
import { gatherActionItems, axesStrategiquesActifs, type AxeDisponible } from '@/lib/action-items.server'
import { peutRattacherStrategie, peutVoirStrategie } from '@/lib/permissions'
import { lirePagination } from '@/lib/pagination'
import { lireFiltresActions, listerActionsPage, TRIS_ACTIONS } from '@/lib/action-items-liste'
import type { EntiteRef } from '@/lib/entites'

export const dynamic = 'force-dynamic'

export const GET = withAccess({ org: 'none' }, async (req: NextRequest, { user }) => {
  const scope = await getAnalyseScope(user.id, user.role)
  const orgIds = resolvePageOrganizationIds(scope.activeOrgId, scope.scope)
  if (!orgIds.length) return NextResponse.json({ error: 'organization_required' }, { status: 400 })

  const strategieActiveParOrg = new Map<string, boolean>()
  const items = (await Promise.all(orgIds.map(async (orgId) => {
    const c = await getOrgConfig(orgId)
    strategieActiveParOrg.set(orgId, !!c.strategieActive)
    return gatherActionItems(orgId, {
      incidentsActive: c.incidentsActive,
      controlePermanentActive: c.controlePermanentActive,
      auditInterneActive: c.auditInterneActive,
      registreRisquesActive: c.registreRisquesActive,
      conformiteActive: c.conformiteActive,
      strategieActive: !!c.strategieActive,
    }, { userId: user.id, role: scope.role, scope: scope.scope })
  }))).flat()

  const sp = req.nextUrl.searchParams
  const pg = lirePagination(sp, { tris: TRIS_ACTIONS, triDefaut: 'defaut' })
  if (!pg) return NextResponse.json({ items })

  const f = lireFiltresActions(sp)
  f.filtre.q = pg.q || undefined
  // Référentiel des entités : seulement si le filtre par entité est demandé (périmètre des organisations lues).
  const entites: EntiteRef[] = f.entite.id
    ? (await prisma.entite.findMany({
        where: { organizationId: { in: orgIds } },
        select: { id: true, nom: true, type: true, alias: true, codeExterne: true, parentId: true, source: true, valideAu: true },
      })).map(e => ({ ...e, alias: Array.isArray(e.alias) ? (e.alias as string[]) : [] }))
    : []
  // Rattachement à un axe : seulement sur l'organisation active explicite (la route POST exige org active).
  const orgActive = orgIds.length === 1 && scope.activeOrgId === orgIds[0] ? orgIds[0] : null
  const possible = !!orgActive && !!scope.role && peutRattacherStrategie(scope.role) && peutVoirStrategie(scope.role) && !!strategieActiveParOrg.get(orgActive)
  const axes: AxeDisponible[] = possible && orgActive && scope.role ? await axesStrategiquesActifs(orgActive, scope.role) : []
  return NextResponse.json({ ...listerActionsPage(items, f, pg, entites, new Date()), rattachement: { possible, axes } })
})
