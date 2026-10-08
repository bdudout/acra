-- Registre des traitements : identité du responsable, du représentant et du DPO (RGPD art. 30 §1 a). Migration additive.
-- CreateTable
CREATE TABLE "RopaIdentite" (
    "organizationId" TEXT NOT NULL,
    "responsableNom" TEXT NOT NULL DEFAULT '',
    "responsableAdresse" TEXT NOT NULL DEFAULT '',
    "responsableContact" TEXT NOT NULL DEFAULT '',
    "representantNom" TEXT NOT NULL DEFAULT '',
    "representantContact" TEXT NOT NULL DEFAULT '',
    "dpoNom" TEXT NOT NULL DEFAULT '',
    "dpoContact" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RopaIdentite_pkey" PRIMARY KEY ("organizationId")
);

-- AddForeignKey
ALTER TABLE "RopaIdentite" ADD CONSTRAINT "RopaIdentite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

