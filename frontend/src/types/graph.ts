/** @id salesblock.types.graph */

// -- Node types that participate in the knowledge graph --

export type GraphNodeType =
  | 'account'
  | 'contact'
  | 'deal'
  | 'note_block'
  | 'signal'
  | 'activity'
  | 'research_entry'

// -- Edge types define semantic relationships --

export type GraphEdgeType =
  | 'references'
  | 'champion_at'
  | 'decision_maker_at'
  | 'blocker_at'
  | 'technical_eval_at'
  | 'economic_buyer_at'
  | 'sourced_from'
  | 'evidence_for'
  | 'contradicts'
  | 'supersedes'
  | 'related_to'
  | 'mentioned_in'
  | 'derived_from'

export type EdgeOrigin =
  | 'manual'
  | 'wikilink_parse'
  | 'ai_suggested'
  | 'attio_import'
  | 'enrichment'
  | 'system'

export type NoteSource =
  | 'manual'
  | 'activity_derived'
  | 'attio_import'
  | 'enrichment'
  | 'ai_generated'

// -- Core entities --

export interface NoteBlock {
  id: string
  org_id: string
  account_id: string
  contact_id: string | null
  content: string
  content_plain: string
  source: NoteSource
  source_id: string | null
  created_by: string
  parent_block_id: string | null
  position: number
  properties: Record<string, unknown>
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface GraphEdge {
  id: string
  org_id: string
  source_type: GraphNodeType
  source_id: string
  target_type: GraphNodeType
  target_id: string
  edge_type: GraphEdgeType
  confidence: number | null
  properties: Record<string, unknown>
  created_by: string | null
  source_origin: EdgeOrigin
  created_at: string
}

export interface Tag {
  id: string
  org_id: string
  name: string
  color: string
  created_by: string | null
  created_at: string
}

export interface EntityTag {
  id: string
  org_id: string
  tag_id: string
  entity_type: GraphNodeType
  entity_id: string
  created_by: string | null
  created_at: string
}

// -- Parsed reference from note content --

export interface ParsedReference {
  entityType: GraphNodeType
  entityId: string
  displayText: string
  startIndex: number
  endIndex: number
}

export interface ParsedTag {
  tagName: string
  startIndex: number
  endIndex: number
}

export interface ParseResult {
  references: ParsedReference[]
  tags: ParsedTag[]
  plainText: string
}

// -- Backlink result --

export interface Backlink {
  edge_id: string
  source_type: GraphNodeType
  source_id: string
  edge_type: GraphEdgeType
  source_origin: EdgeOrigin
  edge_created_at: string
  // Hydrated fields (filled client-side)
  source_content?: string
  source_label?: string
}

// -- Account knowledge graph --

export interface AccountKnowledgeGraph {
  account_id: string
  contacts: Array<{
    id: string
    name: string
    title: string | null
    company: string | null
    contact_purpose: string
  }>
  notes: Array<{
    id: string
    content: string
    content_plain: string
    source: NoteSource
    contact_id: string | null
    created_at: string
    created_by: string
  }>
  signals: Array<{
    id: string
    level: 'account' | 'prospect'
    signal_type: string
    content: string
    confidence: number | null
    classification: string | null
    contact_id: string | null
    created_at: string
  }>
  edges: Array<{
    id: string
    source_type: GraphNodeType
    source_id: string
    target_type: GraphNodeType
    target_id: string
    edge_type: GraphEdgeType
    source_origin: EdgeOrigin
    created_at: string
  }>
  tags: Array<{
    id: string
    name: string
    color: string
    entity_type: GraphNodeType
    entity_id: string
  }>
}

// -- Graph visualization node (for force-directed graph) --

export interface GraphVizNode {
  id: string
  type: GraphNodeType
  label: string
  color: string
  size: number
  data: Record<string, unknown>
}

export interface GraphVizLink {
  source: string
  target: string
  edgeType: GraphEdgeType
  label: string
}
