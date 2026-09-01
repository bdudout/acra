#!/usr/bin/env node
// ─── Créer / réinitialiser un compte administrateur ──────────────────────────
// Hache le mot de passe avec le MÊME algorithme que l'application (bcryptjs, 12
// tours) puis upsert le compte via Prisma. Utile pour reprendre la main sur une
// instance dont aucun mot de passe admin n'est connu.
//
// Usage :
//   node scripts/create-admin.mjs <email> <motdepasse> [role]
//   (role par défaut : SUPER_ADMIN)
//
// Base de données : lue depuis DATABASE_URL.
//   • hôte + Docker : DATABASE_URL="postgresql://acra_user:...@localhost:5432/acra_rm" node scripts/create-admin.mjs ...
//   • dans le conteneur : docker compose exec app node scripts/create-admin.mjs ...
//
// Remarque : ce script contourne volontairement la politique de mot de passe
// (outil d'administration) — choisir un mot de passe robuste.

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'RSSI', 'RISK_MANAGER', 'ANALYSTE', 'LECTEUR', 'DIRECTION_METIER', 'AUDITEUR', 'CONTROLEUR', 'METIER', 'CONFORMITE', 'DPO']

const [email, password, roleArg] = process.argv.slice(2)
const role = (roleArg || 'SUPER_ADMIN').toUpperCase()

if (!email || !password) {
  console.error('Usage : node scripts/create-admin.mjs <email> <motdepasse> [role]')
  console.error(`Rôles : ${ROLES.join(', ')} (défaut SUPER_ADMIN)`)
  process.exit(1)
}
if (!ROLES.includes(role)) {
  console.error(`Rôle invalide : ${role}\nRôles valides : ${ROLES.join(', ')}`)
  process.exit(1)
}
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
  console.log(`✅ Compte prêt : ${user.email} — rôle ${user.role} — actif. Connexion possible avec le mot de passe fourni.`)
} catch (e) {
  console.error('❌ Échec :', e?.message ?? e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
