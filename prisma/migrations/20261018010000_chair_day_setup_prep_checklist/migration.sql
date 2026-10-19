-- AlterTable
ALTER TABLE "ChairDaySetup" ADD COLUMN "checkedItemIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ChairDaySetup" ADD COLUMN "readyAt" TIMESTAMP(3);
ALTER TABLE "ChairDaySetup" ADD COLUMN "readyById" TEXT;
