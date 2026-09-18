#!/usr/bin/env node
// ─── Créer / réinitialiser un compte administrateur ──────────────────────────
// Hache le mot de passe avec le MÊME algorithme que l'application (bcryptjs, 12
// tours) puis upsert le compte via Prisma. Utile pour reprendre la main sur une
// instance dont aucun mot de passe admin n'est connu.
//
// Usage :
//   node scripts/create-admin.mjs <email> [role]
//   (role par défaut : SUPER_ADMIN)
// Le mot de passe est demandé de façon masquée, ou lu depuis
// ACRA_ADMIN_PASSWORD pour une automatisation contrôlée.
//
// Base de données : lue depuis DATABASE_URL.
//   • hôte + Docker : DATABASE_URL="postgresql://acra_user:...@localhost:5432/acra_rm" node scripts/create-admin.mjs ...
//   • dans le conteneur : docker compose exec app node scripts/create-admin.mjs ...
//
// Remarque : ce script contourne volontairement la politique de mot de passe
// (outil d'administration) — choisir un mot de passe robuste.

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Cet outil crée une appartenance ADMIN à la racine ; aucun rôle métier ici.
const ROLES = ['SUPER_ADMIN', 'ADMIN']

const [email, roleArg] = process.argv.slice(2)
const role = (roleArg || 'SUPER_ADMIN').toUpperCase()

if (!email) {
  console.error('Usage : node scripts/create-admin.mjs <email> [role]')
  console.error(`Rôles : ${ROLES.join(', ')} (défaut SUPER_ADMIN)`)
  process.exit(1)
}
if (!ROLES.includes(role)) {
  console.error(`Rôle invalide : ${role}\nRôles valides : ${ROLES.join(', ')}`)
  process.exit(1)
}
async function readPassword() {
  if (process.env.ACRA_ADMIN_PASSWORD) return process.env.ACRA_ADMIN_PASSWORD
  if (!process.stdin.isTTY) {
    throw new Error('Mot de passe absent : définissez ACRA_ADMIN_PASSWORD pour une exécution non interactive.')
  }

  process.stdout.write('Mot de passe administrateur : ')
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  return new Promise((resolve, reject) => {
    let value = ''
    const cleanup = () => {
      process.stdin.off('data', onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
    }
    const onData = (character) => {
      if (character === '\u0003') {
        cleanup()
        process.stdout.write('\n')
        reject(new Error('Saisie annulée.'))
      } else if (character === '\r' || character === '\n') {
        cleanup()
        process.stdout.write('\n')
        resolve(value)
      } else if (character === '\u007f') {
        value = value.slice(0, -1)
      } else {
        value += character
      }
    }
    process.stdin.on('data', onData)
  })
}

const password = await readPassword()
if (password.length < 8) {
  console.error('Le mot de passe doit faire au moins 8 caractères.')
  process.exit(1)
}

const prisma = new PrismaClient()
try {
  const passwordHash = await bcrypt.hash(password, 12)
  const emailNorm = email.toLowerCase().trim()
  const user = await prisma.user.upsert({
    where: { email: emailNorm },
    update: { passwordHash, role, isActive: true, emailVerified: new Date(), mustChangePassword: false },
    create: { email: emailNorm, name: emailNorm.split('@')[0], passwordHash, role, isActive: true, emailVerified: new Date() },
  })
  // Même un SUPER_ADMIN doit être rattaché à la racine : certains écrans et
  // exports utilisent l'appartenance pour proposer le contexte organisationnel.
  await prisma.organization.upsert({
    where: { id: 'global' },
    create: { id: 'global', nom: 'Organisation principale', slug: 'principale', path: '/global/' },
    update: {},
  })
  await prisma.orgMembership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: 'global' } },
    create: { userId: user.id, organizationId: 'global', role: 'ADMIN', scope: 'SUBTREE' },
    update: { role: 'ADMIN', scope: 'SUBTREE' },
  })
  console.log(`✅ Compte prêt : ${user.email} — rôle ${user.role} — actif. Connexion possible avec le mot de passe fourni.`)
} catch (e) {
  console.error('❌ Échec :', e?.message ?? e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
