-- Lot L3 (suite) : rattachement d'un contrôle à un tiers (registre TIC) et à un projet 360.
ALTER TABLE "Controle" ADD COLUMN "arrangementTicId" TEXT;
ALTER TABLE "Controle" ADD COLUMN "projetId" TEXT;
CREATE INDEX "Controle_arrangementTicId_idx" ON "Controle"("arrangementTicId");
CREATE INDEX "Controle_projetId_idx" ON "Controle"("projetId");
