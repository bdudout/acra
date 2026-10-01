-- T23 : invitation à rejoindre une organisation (mode INVITATION) et mode de rattachement d'instance.

-- AlterTable
ALTER TABLE "Configuration" ADD COLUMN     "membershipMode" TEXT NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "membershipNotify" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "OrgInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ANALYSTE',
    "scope" "OrgScope" NOT NULL DEFAULT 'NODE',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgInvitation_tokenHash_key" ON "OrgInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "OrgInvitation_organizationId_idx" ON "OrgInvitation"("organizationId");

-- CreateIndex
CREATE INDEX "OrgInvitation_email_idx" ON "OrgInvitation"("email");

-- AddForeignKey
ALTER TABLE "OrgInvitation" ADD CONSTRAINT "OrgInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

