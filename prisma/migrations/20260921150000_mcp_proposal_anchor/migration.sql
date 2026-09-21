-- Généralise l'ancre des propositions MCP : `analyseId` → `targetType` + `targetId`
-- (une proposition référence toujours un objet concret : ANALYSE|RISQUE|CONFORMITE|
--  CONTROLE|AUDIT|INCIDENT). cf. docs/mcp-cadrage.md §6.

ALTER TABLE "McpProposal" ADD COLUMN "targetType" TEXT NOT NULL DEFAULT 'ANALYSE';
ALTER TABLE "McpProposal" ADD COLUMN "targetId" TEXT;

-- Backfill : les propositions existantes sont ancrées à leur analyse.
UPDATE "McpProposal" SET "targetId" = "analyseId" WHERE "analyseId" IS NOT NULL;

-- Purge des éventuelles propositions sans ancre résoluble (aucune en pratique :
-- fonctionnalité désactivée par défaut). Garantit la contrainte NOT NULL.
DELETE FROM "McpProposal" WHERE "targetId" IS NULL;

ALTER TABLE "McpProposal" ALTER COLUMN "targetId" SET NOT NULL;

DROP INDEX "McpProposal_analyseId_idx";
ALTER TABLE "McpProposal" DROP COLUMN "analyseId";
CREATE INDEX "McpProposal_targetType_targetId_idx" ON "McpProposal"("targetType", "targetId");
