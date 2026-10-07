-- Programme pluriannuel d'audit et de contrôle (lot P1) : plans par équipe, années validées, lignes multi-prismes.
ALTER TABLE "OrganizationConfig" ADD COLUMN "planificationConfig" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "PlanProgramme" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "equipe" TEXT,
    "prismePrincipal" TEXT NOT NULL DEFAULT 'PROCESSUS',
    "mode" TEXT NOT NULL DEFAULT 'FIGE',
    "anneeDebut" INTEGER NOT NULL,
    "anneeFin" INTEGER NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanProgramme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanAnnee" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "preparePar" TEXT,
    "prepareLe" TIMESTAMP(3),
    "validePar" TEXT,
    "valideLe" TIMESTAMP(3),
    "commentaire" TEXT,
    "contenu" JSONB NOT NULL DEFAULT '[]',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "motifRevision" TEXT,
    "historique" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanAnnee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanLigne" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "intitule" TEXT NOT NULL,
    "prisme" TEXT NOT NULL,
    "cibles" JSONB NOT NULL DEFAULT '{}',
    "echantillon" JSONB,
    "debut" DATE,
    "fin" DATE,
    "charge" DOUBLE PRECISION,
    "priorite" INTEGER,
    "responsable" TEXT,
    "statutManuel" TEXT,
    "realisations" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanLigne_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanProgramme_organizationId_type_idx" ON "PlanProgramme"("organizationId", "type");
CREATE UNIQUE INDEX "PlanAnnee_planId_annee_key" ON "PlanAnnee"("planId", "annee");
CREATE INDEX "PlanLigne_planId_annee_idx" ON "PlanLigne"("planId", "annee");

ALTER TABLE "PlanProgramme" ADD CONSTRAINT "PlanProgramme_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanAnnee" ADD CONSTRAINT "PlanAnnee_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanLigne" ADD CONSTRAINT "PlanLigne_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
