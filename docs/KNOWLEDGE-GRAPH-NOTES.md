# SalesBlock Knowledge Graph Notes System

## What Is This?

SalesBlock's notes system works like **Obsidian or LogSeq, but built for sales**. Instead of writing flat notes that sit in isolation, every note you write becomes part of a **knowledge graph** where information links together, surfaces connections, and compounds over time.

The core idea: **each account is its own knowledge universe**. When you target 300 accounts, you build 300 interconnected knowledge clouds where every call note, signal, contact conversation, and piece of third-party intel threads together into a growing picture.

---

## Why This Exists (The Problem With Flat Notes)

Traditional CRM notes are a graveyard:

```
Mar 12 - Called Sarah. She mentioned budget freeze.
Mar 15 - Emailed John about Q2 plans.
Mar 20 - Meeting with Sarah and Dave. Dave is the real decision maker.
```

Three weeks later, you're prepping for a call. You scroll through a wall of text. Who was Dave? What was the budget situation? How does Sarah connect to the deal? You're spending 10 minutes just re-reading context before you can sell.

**With the knowledge graph:**
- "Sarah" is a clickable link to her full contact profile
- "budget freeze" is a tagged signal you can filter by
- "Dave is the real decision maker" automatically creates a relationship edge
- Before your next call, the **backlinks panel** shows you everything that mentions Dave, Sarah, or the budget — across all your notes for that account

---

## How to Use It

### Where to Find It

1. Navigate to any **Account Detail Page** (Accounts > click any account)
2. Click the **Knowledge** tab (between Intelligence and Contacts)
3. You'll see two panels:
   - **Left (2/3 width):** Note editor with your notes timeline
   - **Right (1/3 width):** Backlinks panel showing what references this account

### Writing a Note

Click **"+ Add Note"** and start typing. Notes support two special syntaxes:

#### Linking to Entities with `[[`

Type `[[` and a dropdown appears. Start typing a name:

```
Had a great call with [[    ← dropdown appears
                        Sarah Chen (Contact)
                        Acme Corp (Account)
                        Q2 Expansion (Deal)
```

Select an entity and it becomes a **live link** stored in the note. The link renders as a colored chip:

- 🏢 **Blue chip** = Account
- 👤 **Green chip** = Contact
- 💼 **Amber chip** = Deal

**What happens behind the scenes:** When you save the note, the system automatically creates a `graph_edge` connecting your note to the referenced entity. This is what powers backlinks and the knowledge graph.

#### Tagging with `#`

Add tags anywhere in your note:

```
Spoke with [[contact:uuid:Sarah Chen]] about Q2 budget.
She confirmed #budget-holder status but mentioned #hiring-freeze.
Next step: send ROI calculator. #follow-up-needed
```

Tags appear as purple pills below the note. They're searchable and filterable across all notes in an account.

### Reading Notes

Notes display in reverse chronological order (newest first). Each note shows:
- The full content with rendered entity links (clickable chips)
- Tags as purple pills
- Timestamp and source indicator (manual, imported from Attio, etc.)
- Hover to reveal edit/delete buttons

### Editing and Deleting

- **Edit:** Hover over a note, click the edit icon. The note switches to edit mode with the same `[[` autocomplete available.
- **Delete:** Hover over a note, click the X icon.

---

## The Backlinks Panel (Right Sidebar)

This is where the graph becomes visible. The backlinks panel shows **every note, signal, and entity that references the thing you're looking at**.

Example: You're viewing the **Acme Corp** account. The backlinks panel shows:

```
Backlinks (7)

NOTES (4)
  "Had a great call with Sarah Chen about Acme's Q2..."    references
  "Follow-up: Dave confirmed budget for Q3..."              references
  "Competitive intel: they're also evaluating Gong..."      references
  "Sarah mentioned Acme is restructuring sales team..."     mentioned_in

SIGNALS (2)
  "Budget freeze confirmed by CFO"                          evidence_for
  "Decision maker identified: Dave Patterson"               related_to

CONTACTS (1)
  "Sarah Chen"                                              champion_at
```

**What this means in practice:**
- Before a call, open the account, click Knowledge, and the backlinks panel gives you **every piece of intelligence** about this account in one view
- You can see which contacts are mentioned most (they're your most-touched relationships)
- You can see which signals have evidence (and which contradict each other)

---

## Entity Types and Relationships

### What Can Be Linked

| Entity Type | Icon | What It Is |
|------------|------|-----------|
| Account | 🏢 | A company you're selling to |
| Contact | 👤 | A person at a company |
| Deal | 💼 | A pipeline opportunity |
| Note | 📝 | A knowledge graph note |
| Signal | ⚡ | An intelligence signal (from the Intelligence tab) |
| Activity | 🔄 | A logged call, email, meeting, etc. |

### Edge Types (Relationships Between Entities)

When you link entities, the system creates typed relationships:

| Edge Type | Meaning | Example |
|-----------|---------|---------|
| `references` | Generic mention | Note mentions a contact |
| `champion_at` | Contact is your champion | Sarah is champion at Acme |
| `decision_maker_at` | Contact makes buying decisions | Dave is decision maker at Acme |
| `blocker_at` | Contact is blocking the deal | Legal team is blocker at Acme |
| `evidence_for` | Supports a signal/claim | Call note confirms budget signal |
| `contradicts` | Conflicts with another piece of intel | New info contradicts old signal |
| `supersedes` | Replaces outdated information | Updated org chart supersedes old one |
| `sourced_from` | Intelligence came from this source | Signal sourced from LinkedIn |
| `mentioned_in` | Entity was mentioned in context | Account mentioned in industry report |
| `derived_from` | Created from another entity | Note derived from call activity |

Currently, `[[` wikilinks create `references` edges automatically. Role-based edges (champion, decision maker, etc.) will be assignable via the Contacts tab and future stakeholder mapping UI.

---

## Note Sources

Notes can come from multiple sources, tracked automatically:

| Source | How It Gets Created |
|--------|-------------------|
| `manual` | You typed it in the Knowledge tab |
| `activity_derived` | Auto-generated from a logged call/email/meeting *(future)* |
| `attio_import` | Imported from Attio CRM sync *(future)* |
| `enrichment` | Generated from data enrichment providers *(future)* |
| `ai_generated` | Created by AI analysis of account data *(future)* |

The source badge appears on each note so you always know where information came from.

---

## What's Built vs. What's Coming

### Built and Working Now (KG-001 through KG-005)

| Feature | Status | Where |
|---------|--------|-------|
| Note creation with `[[wikilink]]` autocomplete | Done | Knowledge tab on Account Detail |
| `#tag` parsing and display | Done | Knowledge tab |
| Backlinks panel (grouped by entity type) | Done | Knowledge tab sidebar |
| Graph edges created on note save | Done | Automatic via `sync_note_references` RPC |
| Full-text search on note content | Done | PostgreSQL GIN index on `content_plain` |
| Note CRUD (create, edit, delete) | Done | Knowledge tab |
| Database schema with RLS | Done | Migration `20260325100000` |

### Coming Next (KG-006 through KG-012)

| Feature | Story | What It Does |
|---------|-------|-------------|
| **Contact backlinks** | KG-006 | View all notes mentioning a contact on their detail page |
| **Session cockpit context** | KG-006 | See account knowledge during a SalesBlock session |
| **Knowledge Cloud visualization** | KG-007 | Force-directed graph showing the full account knowledge universe — nodes for contacts, notes, signals, activities; edges showing relationships; minimap + filters |
| **AI context extraction** | KG-008 | `extractSubgraphForLLM(accountId)` pulls the whole knowledge universe into a structured markdown block for LLM analysis — pattern recognition, briefing generation, next-best-action suggestions |
| **Third-party data integration** | KG-009 | Attio imports, activity logs, and enrichment results auto-create notes + edges within account graphs |
| **Tag management** | KG-010 | Tag CRUD with colors, account-scoped filtering |
| **Stakeholder mapping** | KG-011 | Visual map of who's who at an account — champions, decision makers, blockers |
| **Cross-account patterns** | KG-012 | *(Future)* Search across all account graphs for trends |

---

## Why This Structure Matters

### 1. Intelligence Compounds Instead of Decaying

With flat notes, you write something and it disappears into a timeline. With graph notes, every piece of information links to every other piece. After 20 calls with an account, you don't have 20 isolated notes — you have a **web of interconnected intelligence** where you can follow any thread.

### 2. Preparation Time Drops From 10 Minutes to 30 Seconds

Before a call, open the account's Knowledge tab. The backlinks panel shows everything — who said what, which signals are confirmed, what's changed since your last touch. No scrolling through a timeline. No searching your email. It's all there, linked.

### 3. AI Gets Better Context in a Smaller Window

The graph structure is designed for AI consumption. Instead of dumping 50 raw notes into a prompt, `extractSubgraphForLLM` can pull:
- The 5 most-referenced contacts (your key relationships)
- The 3 most-recent signals (what's changed)
- The edges connecting them (how they relate)
- The tags (what themes matter)

This gives an AI model **maximum signal in minimum tokens**. Pattern recognition works better when the context is structured, not a wall of text.

### 4. Knowledge Transfers When Reps Change

When an AE takes over from an SDR, or a new rep inherits a territory, the knowledge graph transfers the entire picture. Not "here are my notes" but "here is the full intelligence map: who the champion is, what pain points are confirmed, which signals contradict each other, and where the deal stands."

### 5. Accounts Become Self-Documenting

Every call, email, meeting, enrichment result, and CRM sync that touches an account adds nodes and edges to its graph. Over time, accounts document themselves. You don't have to remember to take notes — the system captures intelligence from every interaction.

---

## Daily Workflow Example

**Morning prep (2 minutes per account):**
1. Open target account > Knowledge tab
2. Scan recent notes — what happened last?
3. Check backlinks — any new signals or intel since last touch?
4. Check tags — any `#follow-up-needed` or `#objection-unresolved`?
5. You're ready to call

**During a call:**
1. Quick-add a note: `Spoke with [[Sarah Chen]]. She confirmed [[Dave Patterson]] has approved the Q3 budget. #budget-confirmed #next-step-proposal`
2. System auto-creates:
   - `note → references → Sarah Chen` edge
   - `note → references → Dave Patterson` edge
   - `#budget-confirmed` and `#next-step-proposal` tags

**After a call:**
1. The note appears in the Knowledge tab timeline
2. Backlinks on Sarah's contact page now show this note
3. Backlinks on Dave's contact page now show this note
4. The `#budget-confirmed` tag is searchable across the account
5. Next person who preps this account sees the full picture instantly

---

## Technical Architecture (For Developers)

### Schema (6 Tables)

```
note_blocks          → Rich text notes scoped to accounts
graph_edges          → Universal relationship table (any entity → any entity)
tags                 → Org-scoped tag definitions with colors
entity_tags          → Junction: tag → entity
intelligence_signals → Domain-specific signals (confidence, classification)
timeline_events      → Audit trail for all account activity
```

### Key Files

```
types/graph.ts                          → TypeScript types for all graph entities
lib/graph/reference-parser.ts           → [[wikilink]] + #tag parser
lib/queries/graphQueries.ts             → Supabase CRUD + RPC calls
hooks/useNoteBlocks.ts                  → TanStack Query: notes CRUD
hooks/useBacklinks.ts                   → TanStack Query: backlink queries
hooks/useAccountGraph.ts                → TanStack Query: full account graph
components/intelligence/NoteBlockEditor → Note editor with autocomplete
components/intelligence/BacklinksPanel  → Grouped backlinks display
pages/AccountDetailPage.tsx             → Knowledge tab integration
```

### RPC Functions

```sql
sync_note_references(note_id, refs[], tags[])
  → Diff and upsert graph_edges when a note is saved

get_backlinks(entity_type, entity_id)
  → Return all entities that reference a given entity

get_account_knowledge_graph(account_id)
  → Return the FULL knowledge universe for one account:
    contacts, notes, signals, edges, tags
```

### Performance

At 300 accounts x 20 contacts x 50 notes per account:
- ~50-100K graph_edges per org — PostgreSQL handles this easily
- Bidirectional indexes on graph_edges for <10ms backlink queries
- GIN index on `content_plain` for full-text search
- Account-scoped queries keep result sets small and fast
