-- Fix RLS infinite recursion in ALL feature table policies
--
-- Problem: Every feature table policy uses:
--   (SELECT org_id FROM users WHERE id = auth.uid())
-- This subquery hits the users table which has RLS enabled,
-- causing infinite recursion. The fix_rls_infinite_recursion migration
-- created get_user_org_id() (SECURITY DEFINER) to bypass RLS,
-- but only updated organizations, divisions, and teams.
--
-- This migration updates ALL remaining feature tables to use
-- get_user_org_id() instead of the recursive subquery.

-- ============================================================
-- 1. GOALS TABLE
-- ============================================================
DROP POLICY IF EXISTS "Users can view goals in their org" ON goals;
CREATE POLICY "Users can view goals in their org"
  ON goals FOR SELECT
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create own goals" ON goals;
CREATE POLICY "Users can create own goals"
  ON goals FOR INSERT
  WITH CHECK (user_id = auth.uid() AND org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can update own goals" ON goals;
CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own goals" ON goals;
CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Managers can create team goals" ON goals;
CREATE POLICY "Managers can create team goals"
  ON goals FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- ============================================================
-- 2. CONTACTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "contacts_select_own_org" ON contacts;
CREATE POLICY "contacts_select_own_org"
  ON contacts FOR SELECT
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "contacts_insert_own_org" ON contacts;
CREATE POLICY "contacts_insert_own_org"
  ON contacts FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

DROP POLICY IF EXISTS "contacts_update_own_org" ON contacts;
CREATE POLICY "contacts_update_own_org"
  ON contacts FOR UPDATE
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "contacts_delete_own_org" ON contacts;
CREATE POLICY "contacts_delete_own_org"
  ON contacts FOR DELETE
  USING (org_id = get_user_org_id());

-- ============================================================
-- 3. LISTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "lists_select_own_or_shared" ON lists;
CREATE POLICY "lists_select_own_or_shared"
  ON lists FOR SELECT
  USING (
    owner_id = auth.uid()
    OR (is_shared = true AND org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS "lists_insert_own_org" ON lists;
CREATE POLICY "lists_insert_own_org"
  ON lists FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "lists_update_own" ON lists;
CREATE POLICY "lists_update_own"
  ON lists FOR UPDATE
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "lists_delete_own" ON lists;
CREATE POLICY "lists_delete_own"
  ON lists FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================================
-- 4. LIST_CONTACTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "list_contacts_select_accessible_lists" ON list_contacts;
CREATE POLICY "list_contacts_select_accessible_lists"
  ON list_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_contacts.list_id
      AND (
        lists.owner_id = auth.uid()
        OR (lists.is_shared = true AND lists.org_id = get_user_org_id())
      )
    )
  );

DROP POLICY IF EXISTS "list_contacts_insert_own_lists" ON list_contacts;
CREATE POLICY "list_contacts_insert_own_lists"
  ON list_contacts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_contacts.list_id
      AND lists.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "list_contacts_delete_own_lists" ON list_contacts;
CREATE POLICY "list_contacts_delete_own_lists"
  ON list_contacts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_contacts.list_id
      AND lists.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 5. CALL_SCRIPTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "call_scripts_select_policy" ON call_scripts;
CREATE POLICY "call_scripts_select_policy"
  ON call_scripts FOR SELECT
  USING (
    owner_id = auth.uid()
    OR (is_shared = true AND org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS "call_scripts_insert_policy" ON call_scripts;
CREATE POLICY "call_scripts_insert_policy"
  ON call_scripts FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND org_id = get_user_org_id()
  );

DROP POLICY IF EXISTS "call_scripts_update_policy" ON call_scripts;
CREATE POLICY "call_scripts_update_policy"
  ON call_scripts FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "call_scripts_delete_policy" ON call_scripts;
CREATE POLICY "call_scripts_delete_policy"
  ON call_scripts FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================================
-- 6. EMAIL_TEMPLATES TABLE
-- ============================================================
DROP POLICY IF EXISTS "email_templates_select_policy" ON email_templates;
CREATE POLICY "email_templates_select_policy"
  ON email_templates FOR SELECT
  USING (
    owner_id = auth.uid()
    OR (is_shared = true AND org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS "email_templates_insert_policy" ON email_templates;
CREATE POLICY "email_templates_insert_policy"
  ON email_templates FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND org_id = get_user_org_id()
  );

DROP POLICY IF EXISTS "email_templates_update_policy" ON email_templates;
CREATE POLICY "email_templates_update_policy"
  ON email_templates FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "email_templates_delete_policy" ON email_templates;
CREATE POLICY "email_templates_delete_policy"
  ON email_templates FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================================
-- 7. SALESBLOCKS TABLE
-- ============================================================
DROP POLICY IF EXISTS "salesblocks_select_own" ON salesblocks;
CREATE POLICY "salesblocks_select_own"
  ON salesblocks FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "salesblocks_select_team" ON salesblocks;
CREATE POLICY "salesblocks_select_team"
  ON salesblocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'manager'
        AND u.org_id = salesblocks.org_id
    )
  );

DROP POLICY IF EXISTS "salesblocks_insert_own" ON salesblocks;
CREATE POLICY "salesblocks_insert_own"
  ON salesblocks FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id = get_user_org_id()
  );

DROP POLICY IF EXISTS "salesblocks_insert_for_team" ON salesblocks;
CREATE POLICY "salesblocks_insert_for_team"
  ON salesblocks FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "salesblocks_update_own" ON salesblocks;
CREATE POLICY "salesblocks_update_own"
  ON salesblocks FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "salesblocks_delete_own" ON salesblocks;
CREATE POLICY "salesblocks_delete_own"
  ON salesblocks FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 8. ACTIVITIES TABLE
-- ============================================================
DROP POLICY IF EXISTS "activities_select_own" ON activities;
CREATE POLICY "activities_select_own"
  ON activities FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "activities_select_team" ON activities;
CREATE POLICY "activities_select_team"
  ON activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'manager'
        AND u.org_id = activities.org_id
    )
  );

DROP POLICY IF EXISTS "activities_insert_own" ON activities;
CREATE POLICY "activities_insert_own"
  ON activities FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id = get_user_org_id()
  );

DROP POLICY IF EXISTS "activities_update_own" ON activities;
CREATE POLICY "activities_update_own"
  ON activities FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "activities_delete_own" ON activities;
CREATE POLICY "activities_delete_own"
  ON activities FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 9. OAUTH_CONNECTIONS TABLE
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own OAuth connections" ON oauth_connections;
CREATE POLICY "Users can view their own OAuth connections"
  ON oauth_connections FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own OAuth connections" ON oauth_connections;
CREATE POLICY "Users can create their own OAuth connections"
  ON oauth_connections FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own OAuth connections" ON oauth_connections;
CREATE POLICY "Users can update their own OAuth connections"
  ON oauth_connections FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own OAuth connections" ON oauth_connections;
CREATE POLICY "Users can delete their own OAuth connections"
  ON oauth_connections FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 10. PIPELINE_STAGES TABLE
-- ============================================================
DROP POLICY IF EXISTS "Users can view org pipeline stages" ON pipeline_stages;
CREATE POLICY "Users can view org pipeline stages"
  ON pipeline_stages FOR SELECT
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Managers can create pipeline stages" ON pipeline_stages;
CREATE POLICY "Managers can create pipeline stages"
  ON pipeline_stages FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Managers can update pipeline stages" ON pipeline_stages;
CREATE POLICY "Managers can update pipeline stages"
  ON pipeline_stages FOR UPDATE
  USING (
    org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Managers can delete pipeline stages" ON pipeline_stages;
CREATE POLICY "Managers can delete pipeline stages"
  ON pipeline_stages FOR DELETE
  USING (
    org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- ============================================================
-- 11. DEALS TABLE
-- ============================================================
DROP POLICY IF EXISTS "Users can view org deals" ON deals;
CREATE POLICY "Users can view org deals"
  ON deals FOR SELECT
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create own deals" ON deals;
CREATE POLICY "Users can create own deals"
  ON deals FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update own deals" ON deals;
CREATE POLICY "Users can update own deals"
  ON deals FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own deals" ON deals;
CREATE POLICY "Users can delete own deals"
  ON deals FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 12. CUSTOM_KPIS TABLE
-- ============================================================
DROP POLICY IF EXISTS "Users can view custom KPIs in their org" ON custom_kpis;
CREATE POLICY "Users can view custom KPIs in their org"
  ON custom_kpis FOR SELECT
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can insert their own custom KPIs" ON custom_kpis;
CREATE POLICY "Users can insert their own custom KPIs"
  ON custom_kpis FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id = get_user_org_id()
  );

DROP POLICY IF EXISTS "Users can update their own custom KPIs" ON custom_kpis;
CREATE POLICY "Users can update their own custom KPIs"
  ON custom_kpis FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own custom KPIs" ON custom_kpis;
CREATE POLICY "Users can delete their own custom KPIs"
  ON custom_kpis FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 13. TEAM_INVITATIONS TABLE (fix the SELECT policy too)
-- ============================================================
-- The team_invitations SELECT policy from previous migration also
-- uses get_user_org_id() which is fine, but let's ensure the
-- policies from the original migration are also updated

DROP POLICY IF EXISTS "team_invitations_select_policy" ON team_invitations;
-- The newer policy from fix_signup_insert_policies already uses get_user_org_id()
-- so no changes needed there.
