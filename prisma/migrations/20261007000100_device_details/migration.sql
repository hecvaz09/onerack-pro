-- Instance-specific outlet annotations and equipment settings.
ALTER TABLE "DeviceInstance" ADD COLUMN "details" JSONB NOT NULL DEFAULT '{}';
