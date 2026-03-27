/** @id salesblock.lib.queries.graph-queries */
import { supabase } from '../supabase'
import { parseNoteContent } from '../graph/reference-parser'
import type {
  NoteBlock,
  GraphEdge,
  Tag,
  Backlink,
  AccountKnowledgeGraph,
  GraphNodeType,
  GraphEdgeType,
  EdgeOrigin,
  NoteSource,
} from '../../types/graph'

// -- Note Blocks --

export async function createNoteBlock(params: {
  orgId: string
  accountId: string
  contactId?: string | null
  content: string
  source?: NoteSource
  sourceId?: string | null
  createdBy: string
  parentBlockId?: string | null
}): Promise<NoteBlock> {
  const { plainText } = parseNoteContent(params.content)

  const { data, error } = await supabase
    .from('note_blocks')
    .insert({
      org_id: params.orgId,
      account_id: params.accountId,
      contact_id: params.contactId || null,
      content: params.content,
      content_plain: plainText,
      source: params.source || 'manual',
      source_id: params.sourceId || null,
      created_by: params.createdBy,
      parent_block_id: params.parentBlockId || null,
    })
    .select()
    .single()

  if (error) throw error
  return data as NoteBlock
}

export async function updateNoteBlock(
  noteId: string,
  content: string
): Promise<NoteBlock> {
  const { plainText } = parseNoteContent(content)

  const { data, error } = await supabase
    .from('note_blocks')
    .update({
      content,
      content_plain: plainText,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select()
    .single()

  if (error) throw error
  return data as NoteBlock
}

export async function deleteNoteBlock(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('note_blocks')
    .delete()
    .eq('id', noteId)

  if (error) throw error
}

export async function fetchNoteBlocksForAccount(
  accountId: string,
  options?: { contactId?: string; limit?: number }
): Promise<NoteBlock[]> {
  let query = supabase
    .from('note_blocks')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  if (options?.contactId) {
    query = query.eq('contact_id', options.contactId)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as NoteBlock[]
}

/**
 * Save a note and sync its references to graph_edges.
 * Combines note creation/update with reference sync in one call.
 */
export async function saveNoteWithReferences(params: {
  noteId?: string
  orgId: string
  accountId: string
  contactId?: string | null
  content: string
  createdBy: string
}): Promise<NoteBlock> {
  const { references, tags } = parseNoteContent(params.content)

  // Create or update the note
  let note: NoteBlock
  if (params.noteId) {
    note = await updateNoteBlock(params.noteId, params.content)
  } else {
    note = await createNoteBlock({
      orgId: params.orgId,
      accountId: params.accountId,
      contactId: params.contactId,
      content: params.content,
      createdBy: params.createdBy,
    })
  }

  // Sync references via RPC
  const refs = references.map((r) => ({
    entity_type: r.entityType,
    entity_id: r.entityId,
  }))
  const tagNames = tags.map((t) => t.tagName)

  const { error } = await supabase.rpc('sync_note_references', {
    p_note_id: note.id,
    p_org_id: params.orgId,
    p_refs: refs,
    p_tag_names: tagNames,
    p_user_id: params.createdBy,
  })

  if (error) {
    console.error('Failed to sync note references:', error)
  }

  return note
}

// -- Graph Edges --

export async function createGraphEdge(params: {
  orgId: string
  sourceType: GraphNodeType
  sourceId: string
  targetType: GraphNodeType
  targetId: string
  edgeType: GraphEdgeType
  createdBy?: string
  sourceOrigin?: EdgeOrigin
  confidence?: number
}): Promise<GraphEdge> {
  const { data, error } = await supabase
    .from('graph_edges')
    .upsert(
      {
        org_id: params.orgId,
        source_type: params.sourceType,
        source_id: params.sourceId,
        target_type: params.targetType,
        target_id: params.targetId,
        edge_type: params.edgeType,
        created_by: params.createdBy || null,
        source_origin: params.sourceOrigin || 'manual',
        confidence: params.confidence || null,
      },
      { onConflict: 'org_id,source_type,source_id,target_type,target_id,edge_type' }
    )
    .select()
    .single()

  if (error) throw error
  return data as GraphEdge
}

export async function deleteGraphEdge(edgeId: string): Promise<void> {
  const { error } = await supabase
    .from('graph_edges')
    .delete()
    .eq('id', edgeId)

  if (error) throw error
}

// -- Backlinks --

export async function fetchBacklinks(
  entityType: GraphNodeType,
  entityId: string
): Promise<Backlink[]> {
  const { data, error } = await supabase.rpc('get_backlinks', {
    p_entity_type: entityType,
    p_entity_id: entityId,
  })

  if (error) throw error
  return (data || []) as Backlink[]
}

// -- Account Knowledge Graph --

export async function fetchAccountKnowledgeGraph(
  accountId: string
): Promise<AccountKnowledgeGraph> {
  const { data, error } = await supabase.rpc('get_account_knowledge_graph', {
    p_account_id: accountId,
  })

  if (error) throw error
  return (data || { account_id: accountId, contacts: [], notes: [], signals: [], edges: [], tags: [] }) as AccountKnowledgeGraph
}

// -- Tags --

export async function fetchTags(orgId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('org_id', orgId)
    .order('name')

  if (error) throw error
  return (data || []) as Tag[]
}

export async function createTag(params: {
  orgId: string
  name: string
  color?: string
  createdBy: string
}): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .upsert(
      {
        org_id: params.orgId,
        name: params.name.toLowerCase(),
        color: params.color || '#6B7280',
        created_by: params.createdBy,
      },
      { onConflict: 'org_id,name' }
    )
    .select()
    .single()

  if (error) throw error
  return data as Tag
}

// -- Search (for wikilink autocomplete) --

export async function searchEntitiesForReference(
  orgId: string,
  query: string,
  types?: GraphNodeType[]
): Promise<Array<{ type: GraphNodeType; id: string; label: string }>> {
  const results: Array<{ type: GraphNodeType; id: string; label: string }> = []
  const q = `%${query}%`

  const shouldSearch = (type: GraphNodeType) => !types || types.includes(type)

  // Search accounts
  if (shouldSearch('account')) {
    const { data } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('org_id', orgId)
      .ilike('name', q)
      .limit(5)

    if (data) {
      results.push(...data.map((a) => ({ type: 'account' as const, id: a.id, label: a.name })))
    }
  }

  // Search contacts
  if (shouldSearch('contact')) {
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .eq('org_id', orgId)
      .or(`first_name.ilike.${q},last_name.ilike.${q}`)
      .limit(5)

    if (data) {
      results.push(
        ...data.map((c) => ({
          type: 'contact' as const,
          id: c.id,
          label: `${c.first_name} ${c.last_name}`,
        }))
      )
    }
  }

  // Search deals
  if (shouldSearch('deal')) {
    const { data } = await supabase
      .from('deals')
      .select('id, name')
      .eq('org_id', orgId)
      .ilike('name', q)
      .limit(5)

    if (data) {
      results.push(...data.map((d) => ({ type: 'deal' as const, id: d.id, label: d.name })))
    }
  }

  return results
}
