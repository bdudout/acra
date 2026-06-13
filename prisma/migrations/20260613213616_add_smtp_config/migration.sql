-- CreateTable
CREATE TABLE "SMTPConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "host" TEXT,
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "password" TEXT,
    "fromAddress" TEXT,
    "fromName" TEXT DEFAULT 'ACRA',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SMTPConfig_pkey" PRIMARY KEY ("id")
);
