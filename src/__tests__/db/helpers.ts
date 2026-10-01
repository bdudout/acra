// Fabrique de données isolées pour les tests d'intégration (identifiants uniques par test).
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

let seq = 0
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export async function makeOrg(nom = 'Org') {
  const id = `t-${uid()}`
  return prisma.organization.create({ data: { id, nom: `${nom} ${id}`, slug: id, path: `/${id}/` } })
}

export async function makeUser(role: UserRole, orgs: { id: string; role?: UserRole }[] = []) {
  return prisma.user.create({
    data: {
      email: `u-${uid()}@test.acra`, name: 'Test', role,
      memberships: { create: orgs.map(o => ({ organizationId: o.id, role: o.role ?? role, scope: 'NODE' as const })) },
    },
  })
}

/** Requête minimale acceptée par les handlers de route. */
export function jsonRequest(body: unknown, url = 'http://test.local/api'): never {
  return new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.${seq % 250}.${(seq++) % 250}` }, body: JSON.stringify(body) }) as never
}
