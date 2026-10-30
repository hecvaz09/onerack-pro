ALTER TABLE "Connection" ADD COLUMN "fromPort" TEXT, ADD COLUMN "toPort" TEXT;
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_port_pair" CHECK (("fromPort" IS NULL AND "toPort" IS NULL) OR ("fromPort" IS NOT NULL AND "toPort" IS NOT NULL));
CREATE INDEX "Connection_from_endpoint_idx" ON "Connection" ("fromDeviceId", "fromPort");
CREATE INDEX "Connection_to_endpoint_idx" ON "Connection" ("toDeviceId", "toPort");
