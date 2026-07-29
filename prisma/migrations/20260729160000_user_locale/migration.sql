-- Préférence de langue de l'utilisateur (pour les e-mails hors session)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT;
