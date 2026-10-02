-- Relances étendues : alertes DORA, contrats TIC, tests de résilience, KRI, documents,
-- campagnes de contrôle, missions d'audit, échéances d'analyse, invitations.
ALTER TABLE "Incident" ADD COLUMN "alertesDora" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ArrangementTic" ADD COLUMN "rappelLe" TIMESTAMP(3);
ALTER TABLE "TestResilience" ADD COLUMN "rappelLe" TIMESTAMP(3);
ALTER TABLE "Kri" ADD COLUMN "rappelLe" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "rappelLe" TIMESTAMP(3);
ALTER TABLE "CampagneControle" ADD COLUMN "rappelLe" TIMESTAMP(3);
ALTER TABLE "AuditMission" ADD COLUMN "rappelLe" TIMESTAMP(3);
ALTER TABLE "OrgInvitation" ADD COLUMN "rappelLe" TIMESTAMP(3);
ALTER TABLE "Analyse" ADD COLUMN "rappelEcheanceLe" TIMESTAMP(3);
