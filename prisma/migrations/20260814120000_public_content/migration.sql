-- Contenu public configurable au runtime (SUPER_ADMIN), repli i18n si NULL.
ALTER TABLE "Configuration" ADD COLUMN IF NOT EXISTS "publicNotice" TEXT;
ALTER TABLE "Configuration" ADD COLUMN IF NOT EXISTS "publicContactUrl" TEXT;
ALTER TABLE "Configuration" ADD COLUMN IF NOT EXISTS "publicContactLabel" TEXT;
