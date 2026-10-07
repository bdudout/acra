-- Incident ↔ risques du registre (plusieurs) : table de liaison + reprise des rattachements existants (additif).
CREATE TABLE "IncidentRisque" (
    "incidentId" TEXT NOT NULL,
    "riskItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentRisque_pkey" PRIMARY KEY ("incidentId","riskItemId")
);
CREATE INDEX "IncidentRisque_riskItemId_idx" ON "IncidentRisque"("riskItemId");
ALTER TABLE "IncidentRisque" ADD CONSTRAINT "IncidentRisque_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentRisque" ADD CONSTRAINT "IncidentRisque_riskItemId_fkey" FOREIGN KEY ("riskItemId") REFERENCES "RiskItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "IncidentRisque" ("incidentId", "riskItemId")
  SELECT "id", "riskItemId" FROM "Incident" WHERE "riskItemId" IS NOT NULL
  ON CONFLICT DO NOTHING;
