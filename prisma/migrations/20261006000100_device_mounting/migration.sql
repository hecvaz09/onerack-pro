ALTER TABLE "DeviceInstance" ADD COLUMN "mounting" TEXT NOT NULL DEFAULT 'front';
ALTER TABLE "DeviceInstance" ADD CONSTRAINT "DeviceInstance_mounting_check"
  CHECK ("mounting" IN ('front', 'rear', 'rear-left', 'rear-right'));
