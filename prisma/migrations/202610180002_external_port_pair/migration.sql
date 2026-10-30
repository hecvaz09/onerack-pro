ALTER TABLE "Connection" DROP CONSTRAINT "Connection_port_pair";
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_port_pair" CHECK (
  (
    "toDeviceId" IS NOT NULL
    AND "external" IS NULL
    AND (("fromPort" IS NULL AND "toPort" IS NULL)
      OR ("fromPort" IS NOT NULL AND "toPort" IS NOT NULL))
  )
  OR
  (
    "toDeviceId" IS NULL
    AND "external" IS NOT NULL
    AND jsonb_typeof("external") = 'object'
    AND "fromPort" IS NOT NULL
    AND "toPort" IS NULL
  )
);
