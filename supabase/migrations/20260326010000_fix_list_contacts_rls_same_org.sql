-- Fix: Allow same-org users to read list_contacts for SalesBlock sessions
-- Previously only list owners or shared-list members could read contacts
-- This caused empty contact lists when a SalesBlock was assigned to a different user
-- or when the list was created by automation

DROP POLICY IF EXISTS "list_contacts_select_accessible_lists" ON list_contacts;

CREATE POLICY "list_contacts_select_accessible_lists"
  ON list_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_contacts.list_id
      AND lists.org_id = get_user_org_id()
    )
  );
