-- US-008: Contact and list database schema
-- Description: Creates contacts, lists, and junction tables with RLS policies

-- Create contact source enum
CREATE TYPE contact_source AS ENUM ('csv', 'salesforce', 'manual');

-- Contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  source contact_source NOT NULL DEFAULT 'manual',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lists table
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filter_criteria JSONB DEFAULT '{}'::jsonb,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- List-Contact junction table (many-to-many with position tracking)
CREATE TABLE list_contacts (
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (list_id, contact_id)
);

-- Indexes for performance
CREATE INDEX idx_contacts_org_id ON contacts(org_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company);
CREATE INDEX idx_contacts_created_by ON contacts(created_by);
CREATE INDEX idx_lists_org_id ON lists(org_id);
CREATE INDEX idx_lists_owner_id ON lists(owner_id);
CREATE INDEX idx_list_contacts_list_id ON list_contacts(list_id);
CREATE INDEX idx_list_contacts_contact_id ON list_contacts(contact_id);

-- Enable Row Level Security
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contacts
-- Users can read contacts in their org
CREATE POLICY "contacts_select_own_org" ON contacts
  FOR SELECT
  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- Users can create contacts in their org
CREATE POLICY "contacts_insert_own_org" ON contacts
  FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- Users can update contacts in their org
CREATE POLICY "contacts_update_own_org" ON contacts
  FOR UPDATE
  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- Users can delete contacts in their org
CREATE POLICY "contacts_delete_own_org" ON contacts
  FOR DELETE
  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- RLS Policies for lists
-- Users can read their own lists or shared lists in their org
CREATE POLICY "lists_select_own_or_shared" ON lists
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR (is_shared = true AND org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
  );

-- Users can create lists in their org
CREATE POLICY "lists_insert_own_org" ON lists
  FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND owner_id = auth.uid()
  );

-- Users can update their own lists
CREATE POLICY "lists_update_own" ON lists
  FOR UPDATE
  USING (owner_id = auth.uid());

-- Users can delete their own lists
CREATE POLICY "lists_delete_own" ON lists
  FOR DELETE
  USING (owner_id = auth.uid());

-- RLS Policies for list_contacts
-- Users can read list contacts if they can read the list
CREATE POLICY "list_contacts_select_accessible_lists" ON list_contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_contacts.list_id
      AND (
        lists.owner_id = auth.uid()
        OR (lists.is_shared = true AND lists.org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
      )
    )
  );

-- Users can add contacts to lists they own
CREATE POLICY "list_contacts_insert_own_lists" ON list_contacts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_contacts.list_id
      AND lists.owner_id = auth.uid()
    )
  );

-- Users can remove contacts from lists they own
CREATE POLICY "list_contacts_delete_own_lists" ON list_contacts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_contacts.list_id
      AND lists.owner_id = auth.uid()
    )
  );

-- Trigger to update updated_at on contacts
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at_trigger
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- Trigger to update updated_at on lists
CREATE OR REPLACE FUNCTION update_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lists_updated_at_trigger
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION update_lists_updated_at();
