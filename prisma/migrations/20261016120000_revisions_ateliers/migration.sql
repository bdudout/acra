-- Verrou optimiste des ateliers (T9) : révision par atelier, comparée à chaque sauvegarde.
ALTER TABLE "Analyse"
  ADD COLUMN "revisionAtelier1" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revisionAtelier2" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revisionAtelier3" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revisionAtelier4" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revisionAtelier5" INTEGER NOT NULL DEFAULT 0;
