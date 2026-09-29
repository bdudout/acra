-- Analyse cyber issue d'un projet 360 (lien informatif, détaché à la suppression du projet).
ALTER TABLE "Analyse" ADD COLUMN "projetSourceId" TEXT;
CREATE INDEX "Analyse_projetSourceId_idx" ON "Analyse"("projetSourceId");
ALTER TABLE "Analyse" ADD CONSTRAINT "Analyse_projetSourceId_fkey" FOREIGN KEY ("projetSourceId") REFERENCES "Analyse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
