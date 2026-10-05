-- Mesure quotidienne du stockage (additif).
CREATE TABLE "StorageSnapshot" (
    "id" TEXT NOT NULL,
    "mesureLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dbBytes" DOUBLE PRECISION NOT NULL,
    "documentsBytes" DOUBLE PRECISION NOT NULL,
    "backupsBytes" DOUBLE PRECISION NOT NULL,
    "freeBytes" DOUBLE PRECISION,
    "hostReclaimableBytes" DOUBLE PRECISION,

    CONSTRAINT "StorageSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorageSnapshot_mesureLe_idx" ON "StorageSnapshot"("mesureLe");

-- Seuils d'alerte de stockage (additif).
ALTER TABLE "Configuration" ADD COLUMN "storageWarnPercent" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "Configuration" ADD COLUMN "storageCriticalPercent" INTEGER NOT NULL DEFAULT 90;
