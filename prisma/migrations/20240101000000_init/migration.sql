-- CreateEnum
CREATE TYPE "StatutAnalyse" AS ENUM ('EN_COURS', 'TERMINE', 'ARCHIVE');
CREATE TYPE "CategorieSource" AS ENUM ('CYBERCRIMINEL', 'ETAT_NATION', 'CONCURRENT', 'ACTIVISTE', 'EMPLOYE_MALVEILLANT', 'PRESTATAIRE', 'AMATEUR', 'TERRORISTE', 'AUTRE');
CREATE TYPE "TypePartiePrenante" AS ENUM ('FOURNISSEUR', 'CLIENT', 'PARTENAIRE', 'PRESTATAIRE', 'SOUS_TRAITANT', 'ORGANISME_REGULATION', 'AUTRE');
CREATE TYPE "StrategieTraitement" AS ENUM ('REDUIRE', 'ACCEPTER', 'TRANSFERER', 'REFUSER', 'SURVEILLER');
CREATE TYPE "TypeMesure" AS ENUM ('PREVENTIVE', 'DETECTIVE', 'CORRECTIVE', 'DISSUASIVE', 'ORGANISATIONNELLE', 'TECHNIQUE');
CREATE TYPE "StatutMesure" AS ENUM ('A_FAIRE', 'EN_COURS', 'REALISE', 'REPORTE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateTable
CREATE TABLE "Analyse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "organisation" TEXT,
    "secteur" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEcheance" TIMESTAMP(3),
    "statut" "StatutAnalyse" NOT NULL DEFAULT 'EN_COURS',
    "atelierCourant" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Analyse_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Analyse" ADD CONSTRAINT "Analyse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Cadrage" (
    "id" TEXT NOT NULL,
    "analyseId" TEXT NOT NULL,
    "perimetre" TEXT,
    "objectifsEtude" TEXT,
    "valeursMétier" JSONB,
    "biensSupports" JSONB,
    "evenementsRedoutes" JSONB,
    "referentiels" JSONB,
    "socleSecurite" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cadrage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Cadrage_analyseId_key" ON "Cadrage"("analyseId");
ALTER TABLE "Cadrage" ADD CONSTRAINT "Cadrage_analyseId_fkey" FOREIGN KEY ("analyseId") REFERENCES "Analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SourceRisque" (
    "id" TEXT NOT NULL,
    "analyseId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "categorie" "CategorieSource" NOT NULL,
    "description" TEXT,
    "motivation" TEXT,
    "ressources" TEXT,
    "pertinence" INTEGER NOT NULL DEFAULT 1,
    "objectifsVises" JSONB,
    "retenu" BOOLEAN NOT NULL DEFAULT true,
    "justification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SourceRisque_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "SourceRisque" ADD CONSTRAINT "SourceRisque_analyseId_fkey" FOREIGN KEY ("analyseId") REFERENCES "Analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PartiePrenante" (
    "id" TEXT NOT NULL,
    "analyseId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "TypePartiePrenante" NOT NULL,
    "description" TEXT,
    "exposition" INTEGER NOT NULL DEFAULT 1,
    "fiabilite" INTEGER NOT NULL DEFAULT 3,
    "vulnerabilite" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartiePrenante_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "PartiePrenante" ADD CONSTRAINT "PartiePrenante_analyseId_fkey" FOREIGN KEY ("analyseId") REFERENCES "Analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ScenarioStrategique" (
    "id" TEXT NOT NULL,
    "analyseId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "sourceRisqueId" TEXT,
    "objectifVise" TEXT,
    "description" TEXT,
    "cheminAttaque" JSONB,
    "vraisemblance" INTEGER NOT NULL DEFAULT 2,
    "gravite" INTEGER NOT NULL DEFAULT 2,
    "niveauRisque" INTEGER NOT NULL DEFAULT 4,
    "retenu" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScenarioStrategique_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ScenarioStrategique" ADD CONSTRAINT "ScenarioStrategique_analyseId_fkey" FOREIGN KEY ("analyseId") REFERENCES "Analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ScenarioOperationnel" (
    "id" TEXT NOT NULL,
    "analyseId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "scenarioStrategiqueId" TEXT,
    "description" TEXT,
    "actionsElementaires" JSONB,
    "vraisemblance" INTEGER NOT NULL DEFAULT 2,
    "gravite" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScenarioOperationnel_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ScenarioOperationnel" ADD CONSTRAINT "ScenarioOperationnel_analyseId_fkey" FOREIGN KEY ("analyseId") REFERENCES "Analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Risque" (
    "id" TEXT NOT NULL,
    "analyseId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "scenarioOpId" TEXT,
    "description" TEXT,
    "gravite" INTEGER NOT NULL,
    "vraisemblance" INTEGER NOT NULL,
    "niveauRisque" INTEGER NOT NULL,
    "strategie" "StrategieTraitement" NOT NULL DEFAULT 'REDUIRE',
    "graviteResiduelle" INTEGER,
    "vraisemblanceResiduelle" INTEGER,
    "niveauResiduel" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Risque_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Risque" ADD CONSTRAINT "Risque_analyseId_fkey" FOREIGN KEY ("analyseId") REFERENCES "Analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Mesure" (
    "id" TEXT NOT NULL,
    "analyseId" TEXT NOT NULL,
    "risqueId" TEXT,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "type" "TypeMesure" NOT NULL DEFAULT 'PREVENTIVE',
    "priorite" INTEGER NOT NULL DEFAULT 2,
    "statut" "StatutMesure" NOT NULL DEFAULT 'A_FAIRE',
    "responsable" TEXT,
    "echeance" TIMESTAMP(3),
    "cout" TEXT,
    "efficacite" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Mesure_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Mesure" ADD CONSTRAINT "Mesure_analyseId_fkey" FOREIGN KEY ("analyseId") REFERENCES "Analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
