-- Instantanés mensuels d'appétence (RAS / RAD).
CREATE TABLE "AppetenceSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "resume" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppetenceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppetenceSnapshot_organizationId_periode_key" ON "AppetenceSnapshot"("organizationId", "periode");
CREATE INDEX "AppetenceSnapshot_organizationId_idx" ON "AppetenceSnapshot"("organizationId");

ALTER TABLE "AppetenceSnapshot" ADD CONSTRAINT "AppetenceSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
