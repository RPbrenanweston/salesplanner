-- Knowledge Graph + Intelligence Foundation Migration
-- Creates: accounts (if not exists), intelligence_signals, timeline_events,
--          note_blocks, graph_edges, tags, entity_tags
-- Modifies: contacts (account_id, contact_purpose), organizations (default_framework),
--           research_entries (account_id)
-- RPCs: sync_note_references, get_backlinks, get_account_knowledge_graph

-- =============================================================================
-- 1. ACCOUNTS TABLE (may already exist via Supabase dashboard)
-- =============================================================================

CREATE TABLE IF NOT EXISTS accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  phone TEXT,
  employee_count_range TEXT,
  notes TEXT,
  linkedin_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_org_id ON accounts(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_org_name ON accounts(org_id, name);
CREATE INDEX IF NOT EXISTS idx_accounts_domain ON accounts(domain);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe if they don't exist)
DROP POLICY IF EXISTS accounts_select_own_org ON accounts;
DROP POLICY IF EXISTS accounts_insert_own_org ON accounts;
DROP POLICY IF EXISTS accounts_update_own_org ON accounts;
DROP POLICY IF EXISTS accounts_delete_own_org ON accounts;

CREATE POLICY accounts_select_own_org ON accounts
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY accounts_insert_own_org ON accounts
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY accounts_update_own_org ON accounts
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY accounts_delete_own_org ON accounts
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- updated_at trigger (skip if trigger already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'accounts_updated_at_trigger'
  ) THEN
    CREATE TRIGGER accounts_updated_at_trigger
      BEFORE UPDATE ON accounts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =============================================================================
-- 2. CONTACTS: Add account_id and contact_purpose
-- =============================================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_purpose TEXT NOT NULL DEFAULT 'unknown';

-- Add CHECK constraint safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_contact_purpose_check'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_contact_purpose_check
      CHECK (contact_purpose IN ('prospect', 'intel_source', 'internal_champion', 'unknown'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_purpose ON contacts(contact_purpose);

-- =============================================================================
-- 3. INTELLIGENCE SIGNALS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS intelligence_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  level TEXT NOT NULL CHECK (level IN ('account', 'prospect')),
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    -- Account-level
    'business_context', 'problem_fit', 'pain_evidence',
    'economic_impact', 'buying_readiness', 'stakeholder_coverage',
    -- Prospect-level
    'role_relevance', 'influence_level', 'problem_awareness',
    'relationship_strength', 'engagement',
    -- Framework dimension notes
    'fw_bant_budget', 'fw_bant_authority', 'fw_bant_need', 'fw_bant_timeline',
    'fw_spin_situation', 'fw_spin_problem', 'fw_spin_implication', 'fw_spin_need_payoff',
    'fw_meddic_metrics', 'fw_meddic_economic_buyer', 'fw_meddic_decision_criteria',
    'fw_meddic_decision_process', 'fw_meddic_identify_pain', 'fw_meddic_champion'
  )),
  content TEXT NOT NULL,
  classification TEXT CHECK (classification IS NULL OR classification IN (
    'champion', 'influencer', 'connector', 'blocker', 'low_relevance'
  )),
  confidence INTEGER CHECK (confidence IS NULL OR (confidence >= 1 AND confidence <= 5)),
  evidence_reference TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'activity_derived', 'ai_suggested')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_org_id ON intelligence_signals(org_id);
CREATE INDEX IF NOT EXISTS idx_signals_account_id ON intelligence_signals(account_id);
CREATE INDEX IF NOT EXISTS idx_signals_contact_id ON intelligence_signals(contact_id);
CREATE INDEX IF NOT EXISTS idx_signals_type ON intelligence_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_signals_account_level ON intelligence_signals(account_id, level);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON intelligence_signals(created_at);

ALTER TABLE intelligence_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signals_select_own_org ON intelligence_signals;
DROP POLICY IF EXISTS signals_insert_own_org ON intelligence_signals;
DROP POLICY IF EXISTS signals_update_own ON intelligence_signals;
DROP POLICY IF EXISTS signals_delete_own ON intelligence_signals;

CREATE POLICY signals_select_own_org ON intelligence_signals
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY signals_insert_own_org ON intelligence_signals
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY signals_update_own ON intelligence_signals
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY signals_delete_own ON intelligence_signals
  FOR DELETE USING (created_by = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'intelligence_signals_updated_at_trigger'
  ) THEN
    CREATE TRIGGER intelligence_signals_updated_at_trigger
      BEFORE UPDATE ON intelligence_signals
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =============================================================================
-- 4. TIMELINE EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'signal_created', 'signal_updated', 'signal_deleted',
    'classification_changed', 'engagement_event', 'research_note',
    'ai_suggestion', 'framework_review',
    'note_created', 'note_updated', 'edge_created'
  )),
  linked_signal_id UUID REFERENCES intelligence_signals(id) ON DELETE SET NULL,
  linked_note_id UUID,  -- Will reference note_blocks after creation
  title TEXT NOT NULL,
  body TEXT,
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'ai')),
  actor_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns that may be missing if table already existed
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS linked_signal_id UUID;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS linked_note_id UUID;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS actor_type TEXT NOT NULL DEFAULT 'user';
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS actor_id UUID;

-- Add linked_signal_id FK safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timeline_events_linked_signal_id_fkey'
  ) THEN
    ALTER TABLE timeline_events
      ADD CONSTRAINT timeline_events_linked_signal_id_fkey
      FOREIGN KEY (linked_signal_id) REFERENCES intelligence_signals(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_timeline_account_created ON timeline_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_event_type ON timeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_timeline_contact_id ON timeline_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_timeline_org_id ON timeline_events(org_id);

ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS timeline_select_own_org ON timeline_events;
DROP POLICY IF EXISTS timeline_insert_own_org ON timeline_events;
DROP POLICY IF EXISTS timeline_delete_own_org ON timeline_events;

CREATE POLICY timeline_select_own_org ON timeline_events
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY timeline_insert_own_org ON timeline_events
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY timeline_delete_own_org ON timeline_events
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- =============================================================================
-- 5. NOTE BLOCKS TABLE — Graph-native notes scoped to accounts
-- =============================================================================

CREATE TABLE note_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  content_plain TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'activity_derived', 'attio_import', 'enrichment', 'ai_generated')),
  source_id TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_block_id UUID REFERENCES note_blocks(id) ON DELETE SET NULL,
  position INTEGER DEFAULT 0,
  properties JSONB DEFAULT '{}'::jsonb,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_note_blocks_org_id ON note_blocks(org_id);
CREATE INDEX idx_note_blocks_account_id ON note_blocks(account_id);
CREATE INDEX idx_note_blocks_contact_id ON note_blocks(contact_id);
CREATE INDEX idx_note_blocks_created_by ON note_blocks(created_by);
CREATE INDEX idx_note_blocks_parent ON note_blocks(parent_block_id);
CREATE INDEX idx_note_blocks_source ON note_blocks(source);
CREATE INDEX idx_note_blocks_created_at ON note_blocks(created_at DESC);
CREATE INDEX idx_note_blocks_search ON note_blocks USING gin(to_tsvector('english', content_plain));

ALTER TABLE note_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY note_blocks_select_own_org ON note_blocks
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY note_blocks_insert_own_org ON note_blocks
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY note_blocks_update_own ON note_blocks
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY note_blocks_delete_own ON note_blocks
  FOR DELETE USING (created_by = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'note_blocks_updated_at_trigger'
  ) THEN
    CREATE TRIGGER note_blocks_updated_at_trigger
      BEFORE UPDATE ON note_blocks
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Add FK from timeline_events.linked_note_id to note_blocks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_timeline_linked_note'
  ) THEN
    ALTER TABLE timeline_events
      ADD CONSTRAINT fk_timeline_linked_note
      FOREIGN KEY (linked_note_id) REFERENCES note_blocks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =============================================================================
-- 6. GRAPH EDGES TABLE — Universal relationship table
-- =============================================================================

CREATE TABLE graph_edges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'account', 'contact', 'deal', 'note_block', 'signal', 'activity', 'research_entry'
  )),
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN (
    'account', 'contact', 'deal', 'note_block', 'signal', 'activity', 'research_entry'
  )),
  target_id UUID NOT NULL,
  edge_type TEXT NOT NULL CHECK (edge_type IN (
    'references',
    'champion_at', 'decision_maker_at', 'blocker_at',
    'technical_eval_at', 'economic_buyer_at',
    'sourced_from', 'evidence_for', 'contradicts', 'supersedes',
    'related_to', 'mentioned_in', 'derived_from'
  )),
  confidence SMALLINT CHECK (confidence IS NULL OR (confidence >= 1 AND confidence <= 5)),
  properties JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_origin TEXT NOT NULL DEFAULT 'manual' CHECK (source_origin IN (
    'manual', 'wikilink_parse', 'ai_suggested', 'attio_import', 'enrichment', 'system'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, source_type, source_id, target_type, target_id, edge_type)
);

CREATE INDEX idx_graph_edges_source ON graph_edges(org_id, source_type, source_id);
CREATE INDEX idx_graph_edges_target ON graph_edges(org_id, target_type, target_id);
CREATE INDEX idx_graph_edges_type ON graph_edges(org_id, edge_type);
CREATE INDEX idx_graph_edges_origin ON graph_edges(source_origin);

ALTER TABLE graph_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY graph_edges_select_own_org ON graph_edges
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY graph_edges_insert_own_org ON graph_edges
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY graph_edges_update_own_org ON graph_edges
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY graph_edges_delete_own_org ON graph_edges
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- =============================================================================
-- 7. TAGS + ENTITY_TAGS — Cross-cutting tag system
-- =============================================================================

CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name)
);

CREATE INDEX idx_tags_org ON tags(org_id);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tags_select_own_org ON tags
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY tags_insert_own_org ON tags
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY tags_update_own_org ON tags
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY tags_delete_own_org ON tags
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE TABLE entity_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'account', 'contact', 'deal', 'note_block', 'signal', 'activity'
  )),
  entity_id UUID NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tag_id, entity_type, entity_id)
);

CREATE INDEX idx_entity_tags_entity ON entity_tags(org_id, entity_type, entity_id);
CREATE INDEX idx_entity_tags_tag ON entity_tags(tag_id);

ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_tags_select_own_org ON entity_tags
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY entity_tags_insert_own_org ON entity_tags
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY entity_tags_delete_own_org ON entity_tags
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- =============================================================================
-- 8. ORGANIZATION EXTENSIONS
-- =============================================================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_framework TEXT
  CHECK (default_framework IS NULL OR default_framework IN ('spin', 'bant', 'meddic'));

-- =============================================================================
-- 9. RESEARCH ENTRIES: Add account_id for linking
-- =============================================================================

ALTER TABLE research_entries ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_research_account_id ON research_entries(account_id);

-- =============================================================================
-- 10. RPC: sync_note_references — Syncs graph_edges from parsed note content
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_note_references(
  p_note_id UUID,
  p_org_id UUID,
  p_refs JSONB,
  p_tag_names TEXT[],
  p_user_id UUID
) RETURNS void AS $$
BEGIN
  -- Delete old auto-parsed edges for this note
  DELETE FROM graph_edges
  WHERE source_type = 'note_block'
    AND source_id = p_note_id
    AND source_origin = 'wikilink_parse'
    AND org_id = p_org_id;

  -- Insert new reference edges
  INSERT INTO graph_edges (org_id, source_type, source_id, target_type, target_id, edge_type, created_by, source_origin)
  SELECT
    p_org_id,
    'note_block',
    p_note_id,
    (ref->>'entity_type')::text,
    (ref->>'entity_id')::uuid,
    'references',
    p_user_id,
    'wikilink_parse'
  FROM jsonb_array_elements(p_refs) AS ref
  ON CONFLICT (org_id, source_type, source_id, target_type, target_id, edge_type) DO NOTHING;

  -- Sync tags: upsert tags then link to note
  IF p_tag_names IS NOT NULL AND array_length(p_tag_names, 1) > 0 THEN
    -- Ensure tags exist
    INSERT INTO tags (org_id, name, created_by)
    SELECT p_org_id, unnest(p_tag_names), p_user_id
    ON CONFLICT (org_id, name) DO NOTHING;

    -- Remove old tag associations for this note
    DELETE FROM entity_tags
    WHERE entity_type = 'note_block'
      AND entity_id = p_note_id
      AND org_id = p_org_id;

    -- Insert new tag associations
    INSERT INTO entity_tags (org_id, tag_id, entity_type, entity_id, created_by)
    SELECT
      p_org_id,
      t.id,
      'note_block',
      p_note_id,
      p_user_id
    FROM tags t
    WHERE t.org_id = p_org_id
      AND t.name = ANY(p_tag_names)
    ON CONFLICT (tag_id, entity_type, entity_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 11. RPC: get_backlinks — Returns all entities that reference a given entity
-- =============================================================================

CREATE OR REPLACE FUNCTION get_backlinks(
  p_entity_type TEXT,
  p_entity_id UUID
) RETURNS TABLE (
  edge_id UUID,
  source_type TEXT,
  source_id UUID,
  edge_type TEXT,
  source_origin TEXT,
  edge_created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ge.id AS edge_id,
    ge.source_type,
    ge.source_id,
    ge.edge_type,
    ge.source_origin,
    ge.created_at AS edge_created_at
  FROM graph_edges ge
  WHERE ge.target_type = p_entity_type
    AND ge.target_id = p_entity_id
    AND ge.org_id = (SELECT u.org_id FROM users u WHERE u.id = auth.uid())
  ORDER BY ge.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================================
-- 12. RPC: get_account_knowledge_graph — Full knowledge universe for one account
-- =============================================================================

CREATE OR REPLACE FUNCTION get_account_knowledge_graph(
  p_account_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_org_id UUID;
  v_result JSONB;
BEGIN
  -- Verify access via RLS
  SELECT org_id INTO v_org_id FROM accounts WHERE id = p_account_id;
  IF v_org_id IS NULL OR v_org_id != (SELECT u.org_id FROM users u WHERE u.id = auth.uid()) THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'account_id', p_account_id,

    -- All contacts linked to this account
    'contacts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.first_name || ' ' || c.last_name,
        'title', c.title, 'company', c.company,
        'contact_purpose', c.contact_purpose
      ))
      FROM contacts c WHERE c.account_id = p_account_id AND c.org_id = v_org_id
    ), '[]'::jsonb),

    -- All note_blocks for this account
    'notes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', nb.id, 'content', nb.content, 'content_plain', nb.content_plain,
        'source', nb.source, 'contact_id', nb.contact_id,
        'created_at', nb.created_at, 'created_by', nb.created_by
      ) ORDER BY nb.created_at DESC)
      FROM note_blocks nb WHERE nb.account_id = p_account_id AND nb.org_id = v_org_id AND nb.is_archived = FALSE
    ), '[]'::jsonb),

    -- All intelligence_signals for this account
    'signals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'level', s.level, 'signal_type', s.signal_type,
        'content', s.content, 'confidence', s.confidence,
        'classification', s.classification, 'contact_id', s.contact_id,
        'created_at', s.created_at
      ) ORDER BY s.created_at DESC)
      FROM intelligence_signals s WHERE s.account_id = p_account_id AND s.org_id = v_org_id
    ), '[]'::jsonb),

    -- All graph_edges involving entities in this account
    'edges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ge.id, 'source_type', ge.source_type, 'source_id', ge.source_id,
        'target_type', ge.target_type, 'target_id', ge.target_id,
        'edge_type', ge.edge_type, 'source_origin', ge.source_origin,
        'created_at', ge.created_at
      ))
      FROM graph_edges ge
      WHERE ge.org_id = v_org_id
        AND (
          -- Edges from/to account directly
          (ge.source_type = 'account' AND ge.source_id = p_account_id)
          OR (ge.target_type = 'account' AND ge.target_id = p_account_id)
          -- Edges from/to notes in this account
          OR (ge.source_type = 'note_block' AND ge.source_id IN (SELECT nb.id FROM note_blocks nb WHERE nb.account_id = p_account_id))
          OR (ge.target_type = 'note_block' AND ge.target_id IN (SELECT nb.id FROM note_blocks nb WHERE nb.account_id = p_account_id))
          -- Edges from/to signals in this account
          OR (ge.source_type = 'signal' AND ge.source_id IN (SELECT s.id FROM intelligence_signals s WHERE s.account_id = p_account_id))
          OR (ge.target_type = 'signal' AND ge.target_id IN (SELECT s.id FROM intelligence_signals s WHERE s.account_id = p_account_id))
          -- Edges from/to contacts in this account
          OR (ge.source_type = 'contact' AND ge.source_id IN (SELECT c.id FROM contacts c WHERE c.account_id = p_account_id))
          OR (ge.target_type = 'contact' AND ge.target_id IN (SELECT c.id FROM contacts c WHERE c.account_id = p_account_id))
        )
    ), '[]'::jsonb),

    -- All tags on entities in this account
    'tags', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object(
        'id', t.id, 'name', t.name, 'color', t.color,
        'entity_type', et.entity_type, 'entity_id', et.entity_id
      ))
      FROM entity_tags et
      JOIN tags t ON et.tag_id = t.id
      WHERE et.org_id = v_org_id
        AND (
          (et.entity_type = 'account' AND et.entity_id = p_account_id)
          OR (et.entity_type = 'note_block' AND et.entity_id IN (SELECT nb.id FROM note_blocks nb WHERE nb.account_id = p_account_id))
          OR (et.entity_type = 'signal' AND et.entity_id IN (SELECT s.id FROM intelligence_signals s WHERE s.account_id = p_account_id))
          OR (et.entity_type = 'contact' AND et.entity_id IN (SELECT c.id FROM contacts c WHERE c.account_id = p_account_id))
        )
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
