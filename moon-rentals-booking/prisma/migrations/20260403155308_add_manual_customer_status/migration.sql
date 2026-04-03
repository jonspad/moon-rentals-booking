-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "manualVerificationStatus" TEXT;

-- CreateIndex
CREATE INDEX "Customer_manualVerificationStatus_idx" ON "Customer"("manualVerificationStatus");
