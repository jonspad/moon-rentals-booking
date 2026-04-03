-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "internalNotes" TEXT;

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");
