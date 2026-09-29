-- Lot L2 (suite) : gabarits de rapports surchargeables par organisation.
ALTER TABLE "OrganizationConfig" ADD COLUMN "rapportsConfig" JSONB NOT NULL DEFAULT '{}';
