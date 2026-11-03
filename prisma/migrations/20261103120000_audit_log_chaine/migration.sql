-- acra:destructive SET NOT NULL sur AuditLog.seq après remplissage de toutes les lignes existantes dans cette même migration
-- contract: la colonne seq a une valeur par défaut (séquence) : une version précédente qui insère sans la fournir reste compatible
--
-- Journal d'audit infalsifiable : numéro d'ordre (seq) attribué dans l'ordre chronologique, empreintes de chaînage
-- (posées par le scellement planifié, lib/audit-chaine), déclencheur interdisant modification et suppression.

ALTER TABLE "AuditLog" ADD COLUMN "seq" BIGINT;
ALTER TABLE "AuditLog" ADD COLUMN "hashPrecedent" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "hash" TEXT;

CREATE SEQUENCE "AuditLog_seq_seq" OWNED BY "AuditLog"."seq";
UPDATE "AuditLog" a SET "seq" = o.n
  FROM (SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n FROM "AuditLog") o
  WHERE a."id" = o."id";
SELECT setval('"AuditLog_seq_seq"', COALESCE((SELECT max("seq") FROM "AuditLog"), 0) + 1, false);
ALTER TABLE "AuditLog" ALTER COLUMN "seq" SET DEFAULT nextval('"AuditLog_seq_seq"');
ALTER TABLE "AuditLog" ALTER COLUMN "seq" SET NOT NULL;
CREATE UNIQUE INDEX "AuditLog_seq_key" ON "AuditLog"("seq");

-- Immuabilité : aucune suppression (sauf purge explicite de rétention : SET LOCAL acra.audit_purge = 'on') ;
-- seule mise à jour admise = le scellement d'une entrée non scellée (hashPrecedent / hash), sans toucher au contenu.
CREATE OR REPLACE FUNCTION acra_audit_immuable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('acra.audit_purge', true) = 'on' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'AuditLog : suppression interdite (journal immuable)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD."hash" IS NOT NULL OR NEW."hash" IS NULL
     OR NEW."id" IS DISTINCT FROM OLD."id" OR NEW."seq" IS DISTINCT FROM OLD."seq"
     OR NEW."action" IS DISTINCT FROM OLD."action" OR NEW."userId" IS DISTINCT FROM OLD."userId"
     OR NEW."userEmail" IS DISTINCT FROM OLD."userEmail" OR NEW."userRole" IS DISTINCT FROM OLD."userRole"
     OR NEW."targetId" IS DISTINCT FROM OLD."targetId" OR NEW."targetType" IS DISTINCT FROM OLD."targetType"
     OR NEW."ip" IS DISTINCT FROM OLD."ip" OR NEW."details" IS DISTINCT FROM OLD."details"
     OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'AuditLog : modification interdite (journal immuable)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_immuable" BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION acra_audit_immuable();
