-- CreateTable: AuditLog
CREATE TABLE "AuditLog" (
    "id"         TEXT NOT NULL,
    "action"     TEXT NOT NULL,
    "userId"     TEXT,
    "userEmail"  TEXT,
    "userRole"   TEXT,
    "targetId"   TEXT,
    "targetType" TEXT,
    "ip"         TEXT,
    "details"    TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_action_idx"    ON "AuditLog"("action");
CREATE INDEX "AuditLog_userId_idx"    ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
