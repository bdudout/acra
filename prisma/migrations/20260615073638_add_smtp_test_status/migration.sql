-- AlterTable
ALTER TABLE "SMTPConfig" ADD COLUMN     "lastTestAt" TIMESTAMP(3),
ADD COLUMN     "lastTestOk" BOOLEAN NOT NULL DEFAULT false;
