/**
 * Configuration de la CLI Prisma (Prisma 7) : l'URL de la base n'est plus dans le schéma.
 *
 * - La CLI ne charge plus `.env` d'elle-même : on le lit ici s'il existe (poste de développement) ;
 *   en conteneur, DATABASE_URL vient de l'environnement.
 * - `prisma generate` n'a pas besoin de base : une URL absente n'est pas une erreur ici
 *   (`migrate deploy` échouera clairement sans elle).
 * - Aucun import de paquet (seulement des types) : ce fichier est chargé tel quel par la CLI
 *   installée à part dans l'image Docker (service migrator), sans le reste de node_modules.
 */
import { existsSync } from 'node:fs'
import type { PrismaConfig } from 'prisma'

if (existsSync('.env')) process.loadEnvFile('.env')

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
} satisfies PrismaConfig
