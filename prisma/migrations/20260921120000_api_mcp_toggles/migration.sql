-- Interfaces programmatiques (API publique v1, surface MCP) : toggles d instance
-- reglés par le SUPER_ADMIN, DÉSACTIVÉS par défaut (surface minimale par défaut).
ALTER TABLE "Configuration" ADD COLUMN "apiEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Configuration" ADD COLUMN "mcpEnabled" BOOLEAN NOT NULL DEFAULT false;
