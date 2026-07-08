-- Identité figée de l'instance (garde-fou anti-bascule prod → démo).
ALTER TABLE "Configuration" ADD COLUMN "instanceMode" TEXT;
