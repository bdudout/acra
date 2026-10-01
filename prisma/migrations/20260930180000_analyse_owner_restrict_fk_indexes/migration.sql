-- Audit 2026-09-30 : D1 (une analyse ne disparaît plus avec le compte de son auteur :
-- ON DELETE RESTRICT au lieu de CASCADE) et D6 (index des clés étrangères userId).
-- D5 : les index referentielCode sont désormais déclarés dans le schéma (déjà en base).

-- DropForeignKey
ALTER TABLE "Analyse" DROP CONSTRAINT "Analyse_userId_fkey";

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "AnalyseAcces_userId_idx" ON "AnalyseAcces"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "Analyse" ADD CONSTRAINT "Analyse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

