-- Envois périodiques (tableau de bord mensuel) : un seul envoi par tâche et par période.
CREATE TABLE "EnvoiPeriodique" (
    "id" TEXT NOT NULL,
    "tache" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "envoyeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bilan" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "EnvoiPeriodique_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnvoiPeriodique_tache_periode_key" ON "EnvoiPeriodique"("tache", "periode");
