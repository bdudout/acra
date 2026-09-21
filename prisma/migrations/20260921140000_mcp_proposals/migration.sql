-- Propositions MCP (« écritures validées », cf. docs/mcp-cadrage.md §6)
CREATE TABLE "McpProposal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "type" TEXT NOT NULL,
    "analyseId" TEXT,
    "payload" JSONB NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "appliedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "McpProposal_organizationId_statut_idx" ON "McpProposal"("organizationId", "statut");
CREATE INDEX "McpProposal_analyseId_idx" ON "McpProposal"("analyseId");
