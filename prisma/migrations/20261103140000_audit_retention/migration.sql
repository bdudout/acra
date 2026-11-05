-- Rétention du journal d'audit (durée paramétrable, purge archivée avec ancre de reprise de la chaîne).
-- Ajouts uniquement (expand) : aucune donnée existante modifiée ; rétention non définie = conservation illimitée.
ALTER TABLE "SiemConfig" ADD COLUMN "auditRetentionMois" INTEGER;

CREATE TABLE "AuditPurge" (
    "id" TEXT NOT NULL,
    "jusquaSeq" BIGINT NOT NULL,
    "dernierHash" TEXT NOT NULL,
    "nb" INTEGER NOT NULL,
    "avant" TIMESTAMP(3) NOT NULL,
    "archiveCle" TEXT NOT NULL,
    "archiveSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditPurge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditPurge_jusquaSeq_idx" ON "AuditPurge"("jusquaSeq");
