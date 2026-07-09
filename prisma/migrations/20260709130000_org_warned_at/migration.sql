-- Préavis de purge démo (anti-doublon).
ALTER TABLE "Organization" ADD COLUMN "warnedAt" TIMESTAMP(3);
