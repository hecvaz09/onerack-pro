-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customer" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "heightRU" INTEGER NOT NULL DEFAULT 42,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogDevice" (
    "id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "heightRU" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceInstance" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "startRU" INTEGER NOT NULL,
    "rackId" TEXT NOT NULL,
    "catalogDeviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "cableType" TEXT,
    "label" TEXT,
    "fromDeviceId" TEXT NOT NULL,
    "toDeviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Rack" ADD CONSTRAINT "Rack_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInstance" ADD CONSTRAINT "DeviceInstance_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "Rack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInstance" ADD CONSTRAINT "DeviceInstance_catalogDeviceId_fkey" FOREIGN KEY ("catalogDeviceId") REFERENCES "CatalogDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_fromDeviceId_fkey" FOREIGN KEY ("fromDeviceId") REFERENCES "DeviceInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_toDeviceId_fkey" FOREIGN KEY ("toDeviceId") REFERENCES "DeviceInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
