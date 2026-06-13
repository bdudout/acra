-- Cycle de vie des comptes : changement de MDP forcé, suivi d'inactivité
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- Désactivation automatique après inactivité (par défaut 6 mois ; 0 = désactivé)
ALTER TABLE "PasswordPolicy" ADD COLUMN "inactivityDaysLimit" INTEGER NOT NULL DEFAULT 180;
