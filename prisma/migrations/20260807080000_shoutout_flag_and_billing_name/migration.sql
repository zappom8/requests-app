-- AlterTable
ALTER TABLE "Request" DROP COLUMN "shoutOut",
ADD COLUMN     "wantsShoutOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingName" TEXT;
