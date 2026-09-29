-- mapping_mzt : les mesures citent les risques avec le préfixe « R_ » alors que les risques utilisent « RI_ » (alias validé d'avance).
UPDATE "AnalysisImportMapping"
SET "mappings" = jsonb_set("mappings", '{refAliases}', '{"5 - PACS":{"R":"RI"}}'::jsonb, true)
WHERE "id" = 'mapping_mzt_default' AND "organizationId" IS NULL;
