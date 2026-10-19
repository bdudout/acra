-- Bail d'exécution des tâches planifiées : une seule exécution simultanée par tâche.
CREATE TABLE "CronVerrou" (
    "tache" TEXT NOT NULL,
    "jusqua" TIMESTAMP(3) NOT NULL,
    "jeton" TEXT NOT NULL,
    CONSTRAINT "CronVerrou_pkey" PRIMARY KEY ("tache")
);
