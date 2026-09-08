-- Délai maximal d'une dérogation (date butoir plafonnée ; défaut 365 j = 1 an)
ALTER TABLE "OrganizationConfig" ADD COLUMN "derogationDureeMaxJours" INTEGER NOT NULL DEFAULT 365;
