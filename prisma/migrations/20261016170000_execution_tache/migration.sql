-- Journal d'exécution des tâches planifiées : échecs signalés et relançables.
CREATE TABLE "ExecutionTache" (
    "id" TEXT NOT NULL,
    "tache" TEXT NOT NULL,
    "declencheur" TEXT NOT NULL DEFAULT 'CRON',
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "debut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),
    "dureeMs" INTEGER,
    "erreur" TEXT,
    "resume" JSONB,
    CONSTRAINT "ExecutionTache_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExecutionTache_tache_debut_idx" ON "ExecutionTache"("tache", "debut");
CREATE INDEX "ExecutionTache_statut_debut_idx" ON "ExecutionTache"("statut", "debut");
