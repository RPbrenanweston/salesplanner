-- Fix: Allow same-org users to read account_list_items for SalesBlock sessions
DROP POLICY IF EXISTS "account_list_items_select_accessible_lists" ON account_list_items;

CREATE POLICY "account_list_items_select_accessible_lists"
  ON account_list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = account_list_items.list_id
      AND lists.org_id = get_user_org_id()
    )
  );
