ALTER TABLE "Rack" ADD COLUMN "configuration" JSONB NOT NULL DEFAULT '{}';
-- Preserve the U60 interpretation of existing 48U canvases. New racks use explicit profiles.
UPDATE "Rack" SET "configuration"='{"profile":"rnr-60-pockets","pockets":true}'::jsonb WHERE "heightRU"=48;
