-- Anti-doublon des relances : plan annuel soumis (valideurs) et proposition MCP en attente.
ALTER TABLE "McpProposal" ADD COLUMN "rappelLe" TIMESTAMP(3);
ALTER TABLE "PlanAnnee" ADD COLUMN "rappelLe" TIMESTAMP(3);
