-- Vulnérabilités identifiées sur un risque (ISO 27005 identification) — liste JSON [{description}].
ALTER TABLE "Risque" ADD COLUMN "vulnerabilites" JSONB;
