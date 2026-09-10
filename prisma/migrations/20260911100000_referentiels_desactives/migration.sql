-- Codes des référentiels de la bibliothèque GRC (BUILTIN + CUSTOM) désactivés par
-- organisation (ex. écarter les référentiels bancaires pour une org non concernée).
ALTER TABLE "OrganizationConfig" ADD COLUMN "referentielsDesactives" JSONB NOT NULL DEFAULT '[]';
