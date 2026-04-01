/*
  Warnings:

  - You are about to alter the column `vehicleId` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `Vehicle` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `active` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `Vehicle` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `vehicleId` on the `VehicleBlock` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - Added the required column `category` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `groupId` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `make` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `model` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pricePerDay` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seats` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `transmission` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Made the column `image` on table `Vehicle` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vehicleId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "pickupAt" DATETIME NOT NULL,
    "returnAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("createdAt", "email", "fullName", "id", "phone", "pickupAt", "returnAt", "status", "updatedAt", "vehicleId") SELECT "createdAt", "email", "fullName", "id", "phone", "pickupAt", "returnAt", "status", "updatedAt", "vehicleId" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE INDEX "Booking_vehicleId_idx" ON "Booking"("vehicleId");
CREATE INDEX "Booking_pickupAt_returnAt_idx" ON "Booking"("pickupAt", "returnAt");
CREATE INDEX "Booking_status_idx" ON "Booking"("status");
CREATE TABLE "new_Vehicle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "vin" TEXT,
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
INSERT INTO "new_Vehicle" ("color", "createdAt", "id", "image", "updatedAt") SELECT "color", "createdAt", "id", "image", "updatedAt" FROM "Vehicle";
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
    CONSTRAINT "VehicleBlock_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_VehicleBlock" ("createdAt", "endAt", "id", "reason", "startAt", "updatedAt", "vehicleId") SELECT "createdAt", "endAt", "id", "reason", "startAt", "updatedAt", "vehicleId" FROM "VehicleBlock";
DROP TABLE "VehicleBlock";
ALTER TABLE "new_VehicleBlock" RENAME TO "VehicleBlock";
CREATE INDEX "VehicleBlock_vehicleId_idx" ON "VehicleBlock"("vehicleId");
CREATE INDEX "VehicleBlock_startAt_endAt_idx" ON "VehicleBlock"("startAt", "endAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
