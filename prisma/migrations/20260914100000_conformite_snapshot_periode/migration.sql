-- Périodicité des snapshots AUTO de conformité (MENSUEL par défaut).
ALTER TABLE "OrganizationConfig" ADD COLUMN "conformiteSnapshotPeriode" TEXT NOT NULL DEFAULT 'MENSUEL';
