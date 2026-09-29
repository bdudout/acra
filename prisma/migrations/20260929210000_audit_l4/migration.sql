-- Lot L4 « Audit interne » : notation, jalons, indépendance, constats structurés, suivi des recommandations, univers d'audit.
ALTER TABLE "AuditMission" ADD COLUMN "notation" INTEGER;
ALTER TABLE "AuditMission" ADD COLUMN "jalons" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "AuditMission" ADD COLUMN "independance" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "AuditMission" ADD COLUMN "universIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "AuditConstat" ADD COLUMN "critere" TEXT;
ALTER TABLE "AuditConstat" ADD COLUMN "cause" TEXT;
ALTER TABLE "AuditConstat" ADD COLUMN "consequence" TEXT;
ALTER TABLE "AuditConstat" ADD COLUMN "echeanceInitiale" TIMESTAMP(3);
ALTER TABLE "AuditConstat" ADD COLUMN "reports" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "AuditConstat" ADD COLUMN "realiseePar" TEXT;
ALTER TABLE "AuditConstat" ADD COLUMN "realiseeLe" TIMESTAMP(3);
ALTER TABLE "AuditConstat" ADD COLUMN "verifiePar" TEXT;
ALTER TABLE "AuditConstat" ADD COLUMN "verifieLe" TIMESTAMP(3);
ALTER TABLE "AuditConstat" ADD COLUMN "verificationCommentaire" TEXT;
CREATE TABLE "AuditUnivers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'AUTRE',
    "risque" INTEGER NOT NULL DEFAULT 2,
    "cycleAns" INTEGER,
    "processusId" TEXT,
    "commentaire" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuditUnivers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditUnivers_organizationId_idx" ON "AuditUnivers"("organizationId");
ALTER TABLE "AuditUnivers" ADD CONSTRAINT "AuditUnivers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
