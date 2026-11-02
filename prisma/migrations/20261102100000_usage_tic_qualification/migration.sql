-- Qualification des usages de services TIC : périmètre PCI, raccordement au SI, mode d'interconnexion.
-- Ajout de colonnes facultatives uniquement (expand) : aucune donnée existante n'est modifiée.
ALTER TABLE "TierServiceUsage" ADD COLUMN "perimetrePci" BOOLEAN;
ALTER TABLE "TierServiceUsage" ADD COLUMN "avecSi" BOOLEAN;
ALTER TABLE "TierServiceUsage" ADD COLUMN "interconnexion" TEXT;
