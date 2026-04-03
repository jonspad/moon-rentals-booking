-- CreateTable
CREATE TABLE "VehicleGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VehicleGroupVehicle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vehicleGroupId" INTEGER NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleGroupVehicle_vehicleGroupId_fkey" FOREIGN KEY ("vehicleGroupId") REFERENCES "VehicleGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VehicleGroupVehicle_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VehicleGroup_name_idx" ON "VehicleGroup"("name");

-- CreateIndex
CREATE INDEX "VehicleGroup_isActive_idx" ON "VehicleGroup"("isActive");

-- CreateIndex
CREATE INDEX "VehicleGroupVehicle_vehicleGroupId_idx" ON "VehicleGroupVehicle"("vehicleGroupId");

-- CreateIndex
CREATE INDEX "VehicleGroupVehicle_vehicleId_idx" ON "VehicleGroupVehicle"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleGroupVehicle_vehicleGroupId_vehicleId_key" ON "VehicleGroupVehicle"("vehicleGroupId", "vehicleId");
