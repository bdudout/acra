-- Événements du cycle de vie de l'instance (journalisation unique des lignes de .acra-update/events.log).
CREATE TABLE "InstanceEvent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstanceEvent_key_key" ON "InstanceEvent"("key");
