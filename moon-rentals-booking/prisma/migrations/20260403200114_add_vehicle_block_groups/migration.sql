-- CreateTable
CREATE TABLE "VehicleBlockGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "reason" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VehicleBlock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vehicleId" INTEGER NOT NULL,
    "blockGroupId" INTEGER,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VehicleBlock_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VehicleBlock_blockGroupId_fkey" FOREIGN KEY ("blockGroupId") REFERENCES "VehicleBlockGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VehicleBlock" ("createdAt", "endAt", "id", "reason", "startAt", "updatedAt", "vehicleId") SELECT "createdAt", "endAt", "id", "reason", "startAt", "updatedAt", "vehicleId" FROM "VehicleBlock";
DROP TABLE "VehicleBlock";
ALTER TABLE "new_VehicleBlock" RENAME TO "VehicleBlock";
CREATE INDEX "VehicleBlock_vehicleId_idx" ON "VehicleBlock"("vehicleId");
CREATE INDEX "VehicleBlock_blockGroupId_idx" ON "VehicleBlock"("blockGroupId");
CREATE INDEX "VehicleBlock_startAt_endAt_idx" ON "VehicleBlock"("startAt", "endAt");
CREATE UNIQUE INDEX "VehicleBlock_blockGroupId_vehicleId_key" ON "VehicleBlock"("blockGroupId", "vehicleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "VehicleBlockGroup_startAt_endAt_idx" ON "VehicleBlockGroup"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "VehicleBlockGroup_name_idx" ON "VehicleBlockGroup"("name");
