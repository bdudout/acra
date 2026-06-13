-- Migration: add roles, granular access, approval workflow

-- Enum: UserRole
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Enum: AnalysePermission
DO $$ BEGIN
  CREATE TYPE "AnalysePermission" AS ENUM ('LECTURE', 'EDITION', 'APPROBATION');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Enum: StatutAnalyse — add new values
DO $$ BEGIN
  ALTER TYPE "StatutAnalyse" ADD VALUE IF NOT EXISTS 'SOUMIS';
EXCEPTION WHEN others THEN null;
END $$;
DO $$ BEGIN
  ALTER TYPE "StatutAnalyse" ADD VALUE IF NOT EXISTS 'APPROUVE';
EXCEPTION WHEN others THEN null;
END $$;
DO $$ BEGIN
  ALTER TYPE "StatutAnalyse" ADD VALUE IF NOT EXISTS 'REJETE';
EXCEPTION WHEN others THEN null;
END $$;

-- User: add role column
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'ANALYSTE';

-- Analyse: add approval columns
ALTER TABLE "Analyse" ADD COLUMN IF NOT EXISTS "approbateurId" TEXT;
ALTER TABLE "Analyse" ADD COLUMN IF NOT EXISTS "approuveLe" TIMESTAMP(3);
ALTER TABLE "Analyse" ADD COLUMN IF NOT EXISTS "commentaireApprobation" TEXT;

-- Table: AnalyseAcces
CREATE TABLE IF NOT EXISTS "AnalyseAcces" (
  "id"         TEXT NOT NULL,
  "analyseId"  TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "permission" "AnalysePermission" NOT NULL DEFAULT 'LECTURE',
  "invitePar"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnalyseAcces_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AnalyseAcces_analyseId_userId_key" UNIQUE ("analyseId", "userId"),
  CONSTRAINT "AnalyseAcces_analyseId_fkey" FOREIGN KEY ("analyseId") REFERENCES "Analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AnalyseAcces_userId_fkey"   FOREIGN KEY ("userId")    REFERENCES "User"("id")    ON DELETE CASCADE ON UPDATE CASCADE
);
