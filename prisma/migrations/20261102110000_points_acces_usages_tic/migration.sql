-- Points d'accès (URL / hôte) des usages de services TIC. Ajout d'une table (expand) ; aucune donnée existante modifiée.
CREATE TABLE "TierUsageEndpoint" (
    "id" TEXT NOT NULL,
    "usageId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "hote" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "environnement" TEXT,
    "authentification" TEXT,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierUsageEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TierUsageEndpoint_usageId_idx" ON "TierUsageEndpoint"("usageId");
CREATE INDEX "TierUsageEndpoint_organizationId_hote_idx" ON "TierUsageEndpoint"("organizationId", "hote");

ALTER TABLE "TierUsageEndpoint" ADD CONSTRAINT "TierUsageEndpoint_usageId_fkey" FOREIGN KEY ("usageId") REFERENCES "TierServiceUsage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
