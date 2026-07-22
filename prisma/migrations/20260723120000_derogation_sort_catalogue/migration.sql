-- Dérogation : le contrôle dérogé sort du catalogue de vulnérabilités (configurable)
ALTER TABLE "OrganizationConfig"
  ADD COLUMN IF NOT EXISTS "derogationSortCatalogue" BOOLEAN NOT NULL DEFAULT true;
