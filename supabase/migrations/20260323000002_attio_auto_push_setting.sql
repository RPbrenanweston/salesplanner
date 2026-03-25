-- Add Attio auto-push setting to organizations (mirrors sf_auto_push_activities)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS attio_auto_push_activities BOOLEAN DEFAULT false;

COMMENT ON COLUMN organizations.attio_auto_push_activities IS 'When true, automatically push activities to Attio as Notes on People records';
