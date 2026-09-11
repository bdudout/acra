-- Transfert configurable des journaux de sécurité vers un SIEM (singleton global).
CREATE TABLE "SiemConfig" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "endpoint" TEXT,
  "authHeader" TEXT,
  "categories" JSONB NOT NULL DEFAULT '[]',
  "includeStdout" BOOLEAN NOT NULL DEFAULT true,
  "lastDeliveryOk" BOOLEAN NOT NULL DEFAULT false,
  "lastDeliveryAt" TIMESTAMP(3),
  "lastError" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiemConfig_pkey" PRIMARY KEY ("id")
);
