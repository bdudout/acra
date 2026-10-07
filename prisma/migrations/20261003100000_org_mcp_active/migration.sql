-- Interrupteur MCP par organisation (défaut : désactivé).
ALTER TABLE "OrganizationConfig" ADD COLUMN "mcpActive" BOOLEAN NOT NULL DEFAULT false;
