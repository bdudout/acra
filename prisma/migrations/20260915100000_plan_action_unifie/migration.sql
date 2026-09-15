-- Plan d'action unifié (objet de premier plan) + liens polymorphes vers les sources
CREATE TABLE "PlanAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "porteur" TEXT,
    "entite" TEXT,
    "echeance" TIMESTAMP(3),
    "priorite" TEXT NOT NULL DEFAULT 'MAJEUR',
    "statut" TEXT NOT NULL DEFAULT 'A_FAIRE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanActionLien" (
    "id" TEXT NOT NULL,
    "planActionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "ref" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanActionLien_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanAction_organizationId_idx" ON "PlanAction"("organizationId");
CREATE INDEX "PlanAction_statut_idx" ON "PlanAction"("statut");
CREATE INDEX "PlanActionLien_planActionId_idx" ON "PlanActionLien"("planActionId");
CREATE INDEX "PlanActionLien_type_targetId_idx" ON "PlanActionLien"("type", "targetId");

ALTER TABLE "PlanAction" ADD CONSTRAINT "PlanAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanActionLien" ADD CONSTRAINT "PlanActionLien_planActionId_fkey" FOREIGN KEY ("planActionId") REFERENCES "PlanAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
