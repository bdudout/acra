-- Exposition à Internet d'un usage de service tiers (oui / non / non renseignée).
ALTER TABLE "TierServiceUsage" ADD COLUMN "exposeInternet" BOOLEAN;
