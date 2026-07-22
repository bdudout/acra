import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { E2E } from './fixtures'

/**
 * Amorçage déterministe avant la suite E2E : une organisation (dérogations +
 * conformité actives, workflow RSSI), trois utilisateurs (porteur / RSSI /
 * métier) et une analyse avec un socle contenant une non-conformité dérogeable.
 * Idempotent : on nettoie d'abord (préfixe e2e_).
 */
export default async function globalSetup() {
  const prisma = new PrismaClient()
  try {
    await cleanup(prisma)

    const hash = await bcrypt.hash(E2E.password, 10)

    await prisma.organization.create({
      data: { id: E2E.orgId, nom: 'E2E Org', slug: 'e2e-org', path: `/${E2E.orgId}/`, actif: true },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).organizationConfig.create({
      data: {
        id: E2E.orgId,
        derogationsActive: true,
        conformiteActive: true,
        derogationWorkflow: 'RSSI',
      },
    })

    for (const u of Object.values(E2E.users)) {
      await prisma.user.create({
        data: { id: u.id, name: u.email, email: u.email, passwordHash: hash, role: u.role, isActive: true, mustChangePassword: false },
      })
      await prisma.orgMembership.create({
        data: { id: `m_${u.id}`, userId: u.id, organizationId: E2E.orgId, role: u.role, scope: 'SUBTREE' },
      })
    }

    await prisma.analyse.create({
      data: {
        id: E2E.analyseId, userId: E2E.users.porteur.id, nom: 'E2E Analyse', organisation: 'E2E',
        secteur: 'AUTRE', statut: 'EN_COURS', atelierCourant: 1, organizationId: E2E.orgId,
        referentielMesures: E2E.referentiel,
        cadrage: { create: { socleSecurite: E2E.socle } },
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cleanup(prisma: any) {
  await prisma.derogation.deleteMany({ where: { organizationId: E2E.orgId } })
  await prisma.cadrage.deleteMany({ where: { analyseId: E2E.analyseId } })
  await prisma.analyse.deleteMany({ where: { id: E2E.analyseId } })
  await prisma.orgMembership.deleteMany({ where: { organizationId: E2E.orgId } })
  await prisma.user.deleteMany({ where: { id: { in: Object.values(E2E.users).map(u => u.id) } } })
  await prisma.organizationConfig.deleteMany({ where: { id: E2E.orgId } })
  await prisma.organization.deleteMany({ where: { id: E2E.orgId } })
}
