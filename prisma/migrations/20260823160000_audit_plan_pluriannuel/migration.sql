-- Plan d'audit pluriannuel : type de mission + récurrence (planification auto de la suivante)
ALTER TABLE "AuditMission" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'THEMATIQUE';
ALTER TABLE "AuditMission" ADD COLUMN "recurrence" TEXT NOT NULL DEFAULT 'NONE';
