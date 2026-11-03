-- Stratégie de sortie des contrats TIC (DORA art. 28 § 8). Ajouts facultatifs (expand).
ALTER TABLE "ArrangementTic" ADD COLUMN "strategieSortie" TEXT;
ALTER TABLE "ArrangementTic" ADD COLUMN "prestataireAlternatif" TEXT;
ALTER TABLE "ArrangementTic" ADD COLUMN "strategieSortieTesteeLe" DATE;
