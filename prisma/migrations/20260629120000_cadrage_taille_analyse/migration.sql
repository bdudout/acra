-- Profil de dimensionnement de l'analyse (taille/maturité) — issue #37.
-- Défaut STANDARD : rétro-rempli sur les analyses existantes.
ALTER TABLE "Cadrage" ADD COLUMN "tailleAnalyse" TEXT NOT NULL DEFAULT 'STANDARD';
