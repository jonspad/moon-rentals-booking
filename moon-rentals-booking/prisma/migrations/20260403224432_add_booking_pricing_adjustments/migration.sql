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
    "pricePerDaySnapshot" INTEGER NOT NULL,
    "totalDaysSnapshot" INTEGER NOT NULL,
    "totalPriceSnapshot" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "extraFeeAmount" INTEGER NOT NULL DEFAULT 0,
    "finalPriceOverride" INTEGER,
    "pricingNote" TEXT,
    "rejectionReason" TEXT,
    "lastAdminMessageSubject" TEXT,
    "lastAdminMessageBody" TEXT,
    "lastAdminMessagedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("createdAt", "customerId", "email", "fullName", "id", "lastAdminMessageBody", "lastAdminMessageSubject", "lastAdminMessagedAt", "paymentStatus", "phone", "pickupAt", "pricePerDaySnapshot", "rejectionReason", "returnAt", "status", "totalDaysSnapshot", "totalPriceSnapshot", "updatedAt", "vehicleId", "verificationStatus") SELECT "createdAt", "customerId", "email", "fullName", "id", "lastAdminMessageBody", "lastAdminMessageSubject", "lastAdminMessagedAt", "paymentStatus", "phone", "pickupAt", "pricePerDaySnapshot", "rejectionReason", "returnAt", "status", "totalDaysSnapshot", "totalPriceSnapshot", "updatedAt", "vehicleId", "verificationStatus" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE INDEX "Booking_vehicleId_idx" ON "Booking"("vehicleId");
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");
CREATE INDEX "Booking_pickupAt_returnAt_idx" ON "Booking"("pickupAt", "returnAt");
CREATE INDEX "Booking_status_idx" ON "Booking"("status");
CREATE INDEX "Booking_verificationStatus_idx" ON "Booking"("verificationStatus");
CREATE INDEX "Booking_paymentStatus_idx" ON "Booking"("paymentStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
