-- Risque ACTUEL (net) : niveau après prise en compte des mesures de sécurité existantes.
ALTER TABLE "Risque" ADD COLUMN "graviteActuelle" INTEGER;
ALTER TABLE "Risque" ADD COLUMN "vraisemblanceActuelle" INTEGER;
ALTER TABLE "Risque" ADD COLUMN "niveauActuel" INTEGER;
