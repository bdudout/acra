-- Migration: champ entite sur Mesure + modèle OrganizationConfig

-- Ajouter le champ entite sur la table Mesure
ALTER TABLE "Mesure" ADD COLUMN "entite" TEXT;

-- Créer le modèle OrganizationConfig (singleton global)
CREATE TABLE "OrganizationConfig" (
    "id"             TEXT NOT NULL DEFAULT 'global',
    "entitesMesures" JSONB NOT NULL DEFAULT '[]',
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationConfig_pkey" PRIMARY KEY ("id")
);

-- Insérer la ligne singleton avec les entités par défaut
INSERT INTO "OrganizationConfig" ("id", "entitesMesures", "updatedAt")
VALUES ('global', '["DSI", "Métier", "Risques", "RH", "Juridique"]', NOW())
ON CONFLICT ("id") DO NOTHING;
