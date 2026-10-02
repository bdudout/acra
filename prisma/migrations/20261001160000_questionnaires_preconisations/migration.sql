-- CreateTable
CREATE TABLE "QuestionnaireModele" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'QUESTIONNAIRE',
    "referentielCode" TEXT,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireModele_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireEnvoi" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "modeleId" TEXT,
    "campagneId" TEXT,
    "titre" TEXT NOT NULL,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "echeance" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'OUVERT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireEnvoi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireReponse" (
    "id" TEXT NOT NULL,
    "envoiId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repondantId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'A_REPONDRE',
    "reponses" JSONB NOT NULL DEFAULT '[]',
    "soumiseLe" TIMESTAMP(3),
    "revueLe" TIMESTAMP(3),
    "revueParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireReponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preconisation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campagneId" TEXT,
    "reponseId" TEXT,
    "questionId" TEXT,
    "intitule" TEXT NOT NULL,
    "description" TEXT,
    "recommandation" TEXT,
    "criticite" INTEGER,
    "responsableAction" TEXT,
    "responsableId" TEXT,
    "echeance" TIMESTAMP(3),
    "echeanceInitiale" TIMESTAMP(3),
    "reports" JSONB NOT NULL DEFAULT '[]',
    "statut" TEXT NOT NULL DEFAULT 'OUVERT',
    "realiseePar" TEXT,
    "realiseeLe" TIMESTAMP(3),
    "verifiePar" TEXT,
    "verifieLe" TIMESTAMP(3),
    "verificationCommentaire" TEXT,
    "acceptationJustification" TEXT,
    "accepteePar" TEXT,
    "accepteeLe" TIMESTAMP(3),
    "referentielCode" TEXT,
    "exigenceRef" TEXT,
    "riskItemId" TEXT,
    "processusId" TEXT,
    "controleId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preconisation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionnaireModele_organizationId_idx" ON "QuestionnaireModele"("organizationId");

-- CreateIndex
CREATE INDEX "QuestionnaireEnvoi_organizationId_idx" ON "QuestionnaireEnvoi"("organizationId");

-- CreateIndex
CREATE INDEX "QuestionnaireEnvoi_campagneId_idx" ON "QuestionnaireEnvoi"("campagneId");

-- CreateIndex
CREATE INDEX "QuestionnaireReponse_organizationId_idx" ON "QuestionnaireReponse"("organizationId");

-- CreateIndex
CREATE INDEX "QuestionnaireReponse_repondantId_idx" ON "QuestionnaireReponse"("repondantId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireReponse_envoiId_repondantId_key" ON "QuestionnaireReponse"("envoiId", "repondantId");

-- CreateIndex
CREATE INDEX "Preconisation_organizationId_idx" ON "Preconisation"("organizationId");

-- CreateIndex
CREATE INDEX "Preconisation_campagneId_idx" ON "Preconisation"("campagneId");

-- CreateIndex
CREATE INDEX "Preconisation_referentielCode_idx" ON "Preconisation"("referentielCode");

-- CreateIndex
CREATE INDEX "Preconisation_statut_idx" ON "Preconisation"("statut");

-- CreateIndex
CREATE INDEX "Preconisation_responsableId_idx" ON "Preconisation"("responsableId");

-- AddForeignKey
ALTER TABLE "QuestionnaireModele" ADD CONSTRAINT "QuestionnaireModele_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireEnvoi" ADD CONSTRAINT "QuestionnaireEnvoi_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireReponse" ADD CONSTRAINT "QuestionnaireReponse_envoiId_fkey" FOREIGN KEY ("envoiId") REFERENCES "QuestionnaireEnvoi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preconisation" ADD CONSTRAINT "Preconisation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

