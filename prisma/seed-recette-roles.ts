// ─── Comptes de recette par rôle (DÉVELOPPEMENT LOCAL UNIQUEMENT) ─────────────
// Crée ou met à jour un compte par rôle (recette-<role>@acra.test) membre d'une organisation, pour vérifier menus,
// pages et droits rôle par rôle dans le navigateur. Mot de passe : RECETTE_ROLES_PASSWORD, sinon généré ; les
// identifiants sont écrits dans .acra-test-memory/recette-roles.json (ignoré par git), jamais affichés.
//   npx tsx prisma/seed-recette-roles.ts [--org "<nom ou id>"]     créer / mettre à jour
//   npx tsx prisma/seed-recette-roles.ts --purge                    désactiver les comptes et retirer leurs adhésions
// Refuse de s'exécuter si NODE_ENV=production.

import { PrismaClient, type UserRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

if (process.env.NODE_ENV === 'production') { console.error('Refusé : comptes de recette réservés au développement local.'); process.exit(1) }

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
const ROLES: UserRole[] = ['RSSI', 'RISK_MANAGER', 'CONFORMITE', 'DPO', 'CONTROLEUR', 'AUDITEUR', 'DIRECTION_METIER', 'ANALYSTE', 'METIER', 'LECTEUR']
const email = (r: UserRole) => `recette-${r.toLowerCase().replace(/_/g, '-')}@acra.test`
const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined }

async function main() {
  const emails = ROLES.map(email)
  if (process.argv.includes('--purge')) {
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
    await prisma.orgMembership.deleteMany({ where: { userId: { in: users.map(u => u.id) } } })
    await prisma.user.updateMany({ where: { id: { in: users.map(u => u.id) } }, data: { isActive: false } })
    console.log(`${users.length} compte(s) de recette désactivé(s), adhésions retirées.`)
    return
  }
  const cible = arg('--org') ?? 'Organisation principale'
  const org = await prisma.organization.findFirst({ where: { OR: [{ id: cible }, { nom: cible }] }, select: { id: true, nom: true } })
  if (!org) throw new Error(`Organisation introuvable : ${cible}`)
  const motDePasse = process.env.RECETTE_ROLES_PASSWORD ?? `Rr-${randomBytes(12).toString('hex')}-7!`
  const passwordHash = await bcrypt.hash(motDePasse, 12)
  for (const role of ROLES) {
    const user = await prisma.user.upsert({
      where: { email: email(role) },
      create: { email: email(role), name: `Recette ${role}`, role, passwordHash, emailVerified: new Date(), isActive: true, mustChangePassword: false },
      update: { role, passwordHash, isActive: true, mustChangePassword: false, emailVerified: new Date() },
      select: { id: true },
    })
    const m = await prisma.orgMembership.findFirst({ where: { userId: user.id, organizationId: org.id }, select: { id: true } })
    if (m) await prisma.orgMembership.update({ where: { id: m.id }, data: { role } })
    else await prisma.orgMembership.create({ data: { userId: user.id, organizationId: org.id, role } })
  }
  mkdirSync('.acra-test-memory', { recursive: true })
  writeFileSync('.acra-test-memory/recette-roles.json', JSON.stringify({ organisation: org.nom, motDePasse, comptes: Object.fromEntries(ROLES.map(r => [r, email(r)])) }, null, 2), { mode: 0o600 })
  console.log(`${ROLES.length} comptes de recette prêts dans « ${org.nom} » ; identifiants : .acra-test-memory/recette-roles.json`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
