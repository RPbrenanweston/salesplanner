-- Fix missing INSERT policies that block the signup flow
--
-- Problem: New users signing up cannot INSERT into organizations (to create their org)
-- or team_invitations (to update invitation status). The users INSERT policy exists
-- (WITH CHECK true) but organizations has no INSERT policy at all.
--
-- The signup flow sequence is:
-- 1. supabase.auth.signUp() → creates auth.users row
-- 2. INSERT into organizations (new org) → BLOCKED without this fix
-- 3. INSERT into users (new user record) → allowed by existing policy
--
-- This migration adds INSERT policies for the signup flow.

-- Allow authenticated users to create organizations (needed for new org signup)
-- This is safe because creating an org doesn't grant access to other orgs
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to update team_invitations status (mark as accepted)
-- Scoped to invitations matching the user's email
CREATE POLICY "Users can accept their own invitations"
  ON team_invitations FOR UPDATE
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Allow reading team_invitations for the invitation signup flow
-- Users need to read their invitation details before accepting
CREATE POLICY "Users can read their own invitations"
  ON team_invitations FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR org_id = get_user_org_id()
  );
