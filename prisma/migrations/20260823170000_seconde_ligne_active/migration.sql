-- 2ᵉ ligne de défense optionnelle : toggle par organisation (défaut true = mode réglementé)
ALTER TABLE "OrganizationConfig" ADD COLUMN "secondeLigneActive" BOOLEAN NOT NULL DEFAULT true;
