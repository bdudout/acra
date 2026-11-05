-- Famille de risque TIC du registre (axe distinct de la taxonomie). Ajout d'une colonne nullable (expand), rétrocompatible.
ALTER TABLE "RiskItem" ADD COLUMN "familleRisqueTic" TEXT;

CREATE INDEX "RiskItem_familleRisqueTic_idx" ON "RiskItem"("familleRisqueTic");
