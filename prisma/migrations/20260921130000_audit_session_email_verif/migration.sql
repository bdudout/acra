-- F04 (CWE-613) : version de session pour invalider les JWT antérieurs aux
-- révocations (changement/réinitialisation de mot de passe, suspension).
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
-- F07 (CWE-841) : obligation de vérification d email portée par le compte,
-- independante du mode démo.
ALTER TABLE "User" ADD COLUMN "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT false;
