-- AlterTable
ALTER TABLE "Traitement" ADD COLUMN     "catalogueKey" TEXT,
ADD COLUMN     "catalogueVersion" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Traitement_organizationId_catalogueKey_key" ON "Traitement"("organizationId", "catalogueKey");

