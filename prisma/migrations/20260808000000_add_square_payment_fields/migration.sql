-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "squarePaymentId" TEXT,
ADD COLUMN     "squareFeeCents" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Request_squarePaymentId_key" ON "Request"("squarePaymentId");
