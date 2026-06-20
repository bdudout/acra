-- AlterTable
ALTER TABLE "Analyse" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- CreateIndex
CREATE INDEX "Analyse_deletedAt_idx" ON "Analyse"("deletedAt");

