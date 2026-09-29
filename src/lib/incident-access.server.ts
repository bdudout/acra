// ─── Accès aux incidents (routes /api/incidents/[id]/*) ──────────────────────
// Garde commune : incident dans le périmètre de l'utilisateur (404 sinon), module
// actif, rôle EFFECTIF dans l'organisation de la ressource.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'

// La QUALIFICATION relève de la 2ᵉ ligne (risk manager / RSSI / admin). En mode
// « ligne unique » (2ᵉ ligne désactivée), elle est ouverte à la 1ʳᵉ ligne (tout
// rôle sauf lecteur) : taxonomie, coût réel, rattachement au registre.
export function peutQualifier(role: UserRole, secondeLigneActive: boolean): boolean {
  if (!secondeLigneActive) return role !== 'LECTEUR'
  return isAdminRole(role) || role === 'RISK_MANAGER' || role === 'RSSI'
}

export async function loadIncidentInScope(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const incident = await prisma.incident.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: {
      id: true, organizationId: true, statut: true, declarantId: true, taxonomieCode: true,
      quasiIncident: true, pertes: true, recuperationsLignes: true, notifications: true, champs: true,
    },
  })
  if (!incident) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const orgConfig = await getOrgConfig(incident.organizationId)
  if (!orgConfig.incidentsActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { userId, userRole, incident, secondeLigneActive: orgConfig.secondeLigneActive, incidentsConfig: orgConfig.incidentsConfig, champsPersonnalises: orgConfig.champsPersonnalises }
}
