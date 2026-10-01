-- Petite structure : cumul des rôles RSSI, gestionnaire des risques et analyste (désactivé par défaut).
ALTER TABLE "OrganizationConfig" ADD COLUMN "petiteStructure" BOOLEAN NOT NULL DEFAULT false;
