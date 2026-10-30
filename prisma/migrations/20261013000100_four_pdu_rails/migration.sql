ALTER TABLE "DeviceInstance" DROP CONSTRAINT "DeviceInstance_mounting_check";
ALTER TABLE "DeviceInstance" ADD CONSTRAINT "DeviceInstance_mounting_check"
  CHECK ("mounting" IN ('front', 'rear', 'rear-left', 'rear-right', 'rear-left-2', 'rear-right-2'));
