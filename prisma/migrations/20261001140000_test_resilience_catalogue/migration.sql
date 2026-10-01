-- AlterTable
ALTER TABLE "TestResilience" ADD COLUMN     "catalogueKey" TEXT,
ADD COLUMN     "catalogueVersion" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TestResilience_organizationId_catalogueKey_key" ON "TestResilience"("organizationId", "catalogueKey");

