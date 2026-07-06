-- Mention de protection du document d'analyse (label EBIOS RM §3.2)
ALTER TABLE "Analyse" ADD COLUMN "mentionProtection" TEXT NOT NULL DEFAULT 'NON_PROTEGEE';
