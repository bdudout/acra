-- Registre des traitements : suivi de l'AIPD (statut, analyse rattachée, date, justification, consultation préalable).
-- Migration additive.
-- AlterTable
ALTER TABLE "Traitement" ADD COLUMN     "aipdAnalyseId" TEXT,
ADD COLUMN     "aipdConsultationPrealable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aipdDate" DATE,
ADD COLUMN     "aipdJustification" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "aipdStatut" TEXT;

-- AddForeignKey
ALTER TABLE "Traitement" ADD CONSTRAINT "Traitement_aipdAnalyseId_fkey" FOREIGN KEY ("aipdAnalyseId") REFERENCES "Analyse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

