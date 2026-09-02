-- Domaine de filière (contrôle/audit) sur les référentiels custom.
-- Défaut SECURITE_SI : l'existant est cyber → rétrocompatible, aucune donnée à muter.
-- Ouvre les référentiels non-cyber (LCB-FT, gel des avoirs, comptable, octroi crédit…).
ALTER TABLE "Referentiel" ADD COLUMN "domaine" TEXT NOT NULL DEFAULT 'SECURITE_SI';
CREATE INDEX "Referentiel_organizationId_domaine_idx" ON "Referentiel"("organizationId", "domaine");
