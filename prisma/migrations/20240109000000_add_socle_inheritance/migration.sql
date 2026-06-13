-- AddColumn isSocle
ALTER TABLE "Analyse" ADD COLUMN "isSocle" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn socleId (self-referential FK, nullable)
ALTER TABLE "Analyse" ADD COLUMN "socleId" TEXT;

-- AddForeignKey
ALTER TABLE "Analyse" ADD CONSTRAINT "Analyse_socleId_fkey"
  FOREIGN KEY ("socleId") REFERENCES "Analyse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
