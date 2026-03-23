-- Add list_type column to lists table (default 'contacts' for backward compat)
ALTER TABLE lists ADD COLUMN IF NOT EXISTS list_type text NOT NULL DEFAULT 'contacts';

-- Create account_list_items junction table (mirrors list_contacts for accounts)
CREATE TABLE IF NOT EXISTS account_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(list_id, account_id)
);

-- RLS policies for account_list_items (match list_contacts patterns)
ALTER TABLE account_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view account list items in their org"
  ON account_list_items FOR SELECT
  USING (
    list_id IN (
      SELECT id FROM lists WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert account list items in their org"
  ON account_list_items FOR INSERT
  WITH CHECK (
    list_id IN (
      SELECT id FROM lists WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete account list items in their org"
  ON account_list_items FOR DELETE
  USING (
    list_id IN (
      SELECT id FROM lists WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );
