-- AlterTable: add isActive to User with default true (existing rows become active)
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
