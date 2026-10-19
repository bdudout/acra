#!/usr/bin/env node
// ─── Comptes de recette (tests par scénarios) ────────────────────────────────
// Remet en état, sur l'instance LOCALE uniquement, les comptes de test listés dans
// `.acra-test-memory/recette-roles.json` (+ un compte SUPER_ADMIN de recette) :
// mot de passe commun du fichier (haché comme l'application : bcryptjs, 12 tours),
// compte actif, pas de changement de mot de passe forcé. Les appartenances aux
// organisations « Bac à sable — … » existantes ne sont pas touchées ; le
// SUPER_ADMIN est rattaché à la racine (comme scripts/create-admin.mjs).
//
// Usage : DATABASE_URL=postgresql://…@localhost:5432/acra_rm node comptes-recette.mjs <recette-roles.json>
// N'affiche jamais le mot de passe.

import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const SUPER_ADMIN_EMAIL = 'recette-superadmin@acra.test'

const fichier = process.argv[2]
if (!fichier) { console.error('Usage : node comptes-recette.mjs <recette-roles.json>'); process.exit(1) }

const url = process.env.DATABASE_URL ?? ''
const hote = (() => { try { return new URL(url).hostname } catch { return '' } })()
if (!['localhost', '127.0.0.1', '::1'].includes(hote)) {
  console.error(`Refusé : base non locale (${hote || 'DATABASE_URL absente'}).`)
  process.exit(2)
}

const conf = JSON.parse(readFileSync(fichier, 'utf8'))
const motDePasse = conf.motDePasse
if (typeof motDePasse !== 'string' || motDePasse.length < 12) { console.error('Mot de passe de recette absent ou trop court.'); process.exit(1) }

const comptes = Object.entries(conf.comptes ?? {}).map(([role, email]) => ({ role, email: String(email).toLowerCase().trim() }))
comptes.push({ role: 'SUPER_ADMIN', email: SUPER_ADMIN_EMAIL })

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
try {
  const passwordHash = await bcrypt.hash(motDePasse, 12)
  for (const { role, email } of comptes) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role, isActive: true, mustChangePassword: false, emailVerified: new Date() },
      create: { email, name: `Recette ${role}`, passwordHash, role, isActive: true, emailVerified: new Date() },
    })
    if (role === 'SUPER_ADMIN') {
      await prisma.orgMembership.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: 'global' } },
        create: { userId: user.id, organizationId: 'global', role: 'ADMIN', scope: 'SUBTREE' },
        update: {},
      })
    }
    console.log(`✓ ${email} — ${role}`)
  }
} catch (e) {
  console.error('Échec :', e?.message ?? e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
