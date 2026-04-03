/*
  Warnings:

  - You are about to drop the `AdminUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `internalNotes` on the `Vehicle` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "AdminUser_username_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AdminUser";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "CustomerDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "bookingId" INTEGER,
    "documentType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CustomerDocument_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vehicleId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "pickupAt" DATETIME NOT NULL,
    "returnAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "rejectionReason" TEXT,
    "lastAdminMessageSubject" TEXT,
    "lastAdminMessageBody" TEXT,
    "lastAdminMessagedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("createdAt", "customerId", "email", "fullName", "id", "lastAdminMessageBody", "lastAdminMessageSubject", "lastAdminMessagedAt", "phone", "pickupAt", "rejectionReason", "returnAt", "status", "updatedAt", "vehicleId") SELECT "createdAt", "customerId", "email", "fullName", "id", "lastAdminMessageBody", "lastAdminMessageSubject", "lastAdminMessagedAt", "phone", "pickupAt", "rejectionReason", "returnAt", "status", "updatedAt", "vehicleId" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE INDEX "Booking_vehicleId_idx" ON "Booking"("vehicleId");
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");
CREATE INDEX "Booking_pickupAt_returnAt_idx" ON "Booking"("pickupAt", "returnAt");
CREATE INDEX "Booking_status_idx" ON "Booking"("status");
CREATE INDEX "Booking_verificationStatus_idx" ON "Booking"("verificationStatus");
CREATE INDEX "Booking_paymentStatus_idx" ON "Booking"("paymentStatus");
CREATE TABLE "new_Customer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Customer" ("createdAt", "email", "fullName", "id", "notes", "phone", "updatedAt") SELECT "createdAt", "email", "fullName", "id", "notes", "phone", "updatedAt" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
CREATE INDEX "Customer_fullName_idx" ON "Customer"("fullName");
CREATE INDEX "Customer_verificationStatus_idx" ON "Customer"("verificationStatus");
CREATE TABLE "new_Vehicle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "vin" TEXT,
    "licensePlate" TEXT,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "transmission" TEXT NOT NULL,
    "pricePerDay" INTEGER NOT NULL,
    "image" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Vehicle" ("category", "color", "createdAt", "description", "groupId", "id", "image", "isActive", "licensePlate", "make", "model", "pricePerDay", "seats", "slug", "transmission", "updatedAt", "vin", "year") SELECT "category", "color", "createdAt", "description", "groupId", "id", "image", "isActive", "licensePlate", "make", "model", "pricePerDay", "seats", "slug", "transmission", "updatedAt", "vin", "year" FROM "Vehicle";
DROP TABLE "Vehicle";
ALTER TABLE "new_Vehicle" RENAME TO "Vehicle";
CREATE UNIQUE INDEX "Vehicle_slug_key" ON "Vehicle"("slug");
CREATE INDEX "Vehicle_groupId_idx" ON "Vehicle"("groupId");
CREATE INDEX "Vehicle_category_idx" ON "Vehicle"("category");
CREATE INDEX "Vehicle_isActive_idx" ON "Vehicle"("isActive");
CREATE TABLE "new_VehicleBlock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vehicleId" INTEGER NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VehicleBlock_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VehicleBlock" ("createdAt", "endAt", "id", "reason", "startAt", "updatedAt", "vehicleId") SELECT "createdAt", "endAt", "id", "reason", "startAt", "updatedAt", "vehicleId" FROM "VehicleBlock";
DROP TABLE "VehicleBlock";
ALTER TABLE "new_VehicleBlock" RENAME TO "VehicleBlock";
CREATE INDEX "VehicleBlock_vehicleId_idx" ON "VehicleBlock"("vehicleId");
CREATE INDEX "VehicleBlock_startAt_endAt_idx" ON "VehicleBlock"("startAt", "endAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CustomerDocument_customerId_idx" ON "CustomerDocument"("customerId");

-- CreateIndex
CREATE INDEX "CustomerDocument_bookingId_idx" ON "CustomerDocument"("bookingId");

-- CreateIndex
CREATE INDEX "CustomerDocument_documentType_idx" ON "CustomerDocument"("documentType");

-- CreateIndex
CREATE INDEX "CustomerDocument_status_idx" ON "CustomerDocument"("status");
