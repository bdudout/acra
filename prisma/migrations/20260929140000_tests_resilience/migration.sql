-- Programme de tests de résilience opérationnelle numérique (DORA art. 24 à 26).
CREATE TABLE "TestResilience" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "intitule" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "perimetre" TEXT,
    "fonctionCritique" BOOLEAN NOT NULL DEFAULT false,
    "processusId" TEXT,
    "riskItemIds" JSONB NOT NULL DEFAULT '[]',
    "testeur" TEXT NOT NULL DEFAULT 'INTERNE',
    "independant" BOOLEAN NOT NULL DEFAULT true,
    "statut" TEXT NOT NULL DEFAULT 'PLANIFIE',
    "datePrevue" TIMESTAMP(3),
    "dateRealisation" TIMESTAMP(3),
    "resultat" TEXT,
    "constats" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TestResilience_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TestResilience_organizationId_annee_idx" ON "TestResilience"("organizationId", "annee");
ALTER TABLE "TestResilience" ADD CONSTRAINT "TestResilience_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
