-- Photo mensuelle des indicateurs du dossier de comité (tendance ↑↓).
-- CreateTable
CREATE TABLE "ComiteSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "valeurs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComiteSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComiteSnapshot_organizationId_periode_key" ON "ComiteSnapshot"("organizationId", "periode");

