-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "lastAdminMessageBody" TEXT;
ALTER TABLE "Booking" ADD COLUMN "lastAdminMessageSubject" TEXT;
ALTER TABLE "Booking" ADD COLUMN "lastAdminMessagedAt" DATETIME;
ALTER TABLE "Booking" ADD COLUMN "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "licensePlate" TEXT;
