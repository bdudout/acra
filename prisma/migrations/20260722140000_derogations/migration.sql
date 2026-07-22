-- Dérogations : acceptation temporaire d'une non-conformité au socle (docs/derogations-spec.md)

-- OrganizationConfig : toggle + durée par défaut + fenêtre d'alerte
ALTER TABLE "OrganizationConfig"
  ADD COLUMN "derogationsActive"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "derogationDureeDefautJours" INTEGER NOT NULL DEFAULT 180,
  ADD COLUMN "derogationAlerteJours"      INTEGER NOT NULL DEFAULT 30;

-- Table des dérogations
CREATE TABLE "Derogation" (
  "id"                      TEXT NOT NULL,
  "organizationId"          TEXT NOT NULL,
  "analyseId"               TEXT NOT NULL,
  "portee"                  TEXT NOT NULL,
  "referentiel"             TEXT,
  "ref"                     TEXT,
  "risqueId"                TEXT,
  "intitule"                TEXT NOT NULL,
  "motif"                   TEXT NOT NULL,
  "mesuresCompensatoires"   TEXT NOT NULL,
  "statut"                  TEXT NOT NULL DEFAULT 'DEMANDEE',
  "demandeurId"             TEXT NOT NULL,
  "avisRssiPar"             TEXT,
  "avisRssiLe"              TIMESTAMP(3),
  "avisRssiFavorable"       BOOLEAN,
  "avisRssiCommentaire"     TEXT,
  "doubleRegardPar"         TEXT,
  "doubleRegardLe"          TIMESTAMP(3),
  "doubleRegardFavorable"   BOOLEAN,
  "doubleRegardCommentaire" TEXT,
  "valideePar"              TEXT,
  "valideeLe"               TIMESTAMP(3),
  "dateDebut"               TIMESTAMP(3),
  "dateFin"                 TIMESTAMP(3),
  "prolongations"           JSONB NOT NULL DEFAULT '[]',
  "prolongationDemandee"    TIMESTAMP(3),
  "preuves"                 JSONB NOT NULL DEFAULT '[]',
  "clotureePar"             TEXT,
  "clotureeLe"              TIMESTAMP(3),
  "clotureCommentaire"      TEXT,
  "revoqueePar"             TEXT,
  "revoqueeLe"              TIMESTAMP(3),
  "revoqueMotif"            TEXT,
  "rejeteePar"              TEXT,
  "rejeteeLe"               TIMESTAMP(3),
  "rejetMotif"              TEXT,
  "alerteeLe"               TIMESTAMP(3),
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Derogation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Derogation_organizationId_idx" ON "Derogation"("organizationId");
CREATE INDEX "Derogation_analyseId_idx"      ON "Derogation"("analyseId");
CREATE INDEX "Derogation_statut_idx"         ON "Derogation"("statut");
CREATE INDEX "Derogation_risqueId_idx"       ON "Derogation"("risqueId");

ALTER TABLE "Derogation"
  ADD CONSTRAINT "Derogation_organizationId_fkey" FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Derogation"
  ADD CONSTRAINT "Derogation_analyseId_fkey" FOREIGN KEY ("analyseId")
  REFERENCES "Analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Derogation"
  ADD CONSTRAINT "Derogation_risqueId_fkey" FOREIGN KEY ("risqueId")
  REFERENCES "Risque"("id") ON DELETE SET NULL ON UPDATE CASCADE;
