# Session Cockpit — Middle Ground PRD
> Branch: claude/elegant-elion | Version: 1.1 (refined) | Date: 2026-03-11
> Design source: Stitch mockups + Lovable app screenshots
> Design system: VV (Void Vault) — void-950 bg, indigo-electric accents — DO NOT alter to Stitch colors

---

## Overview

The Session Cockpit is the real-time interface sales reps use during active SalesBlock sessions. The Middle Ground bridges the current rough implementation to a properly structured cockpit that enables decent call statistics without requiring AI features.

**Non-goals for this tier:**
- AI features of any kind (suggestion bar, auto-sentiment, AI research)
- Large prospect photos (future: LinkedIn photo passthrough)
- Tier 1 Target badges
- Sentiment analysis on activities
- Call recording playback

---

## Tier Summary

| Tier | Scope |
|------|-------|
| **Here & Now** | DB migrations only. No UI changes. |
| **Middle Ground** | Structured cockpit UI, dispositions, connected flow, research panel, cadence follow-up |
| **Ideal State** | AI features, sentiment, call recording, AI suggestion bar |

---

## Part 1: Database Migrations Required (Middle Ground)

### Migration 1: `session_type` on `salesblocks`

```sql
ALTER TABLE salesblocks
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'call'
  CHECK (session_type IN ('call', 'email', 'social'));
```

**Why:** Drives the disposition button set, script label, and column headers shown during the session. A call block shows call dispositions; an email block shows email dispositions; a social block shows social touchpoint options.

---

### Migration 2: `progress_flags` on `activities`

```sql
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS progress_flags JSONB DEFAULT NULL;
```

**Shape when `outcome = 'connect'`:**
```json
{
  "intro_given": false,
  "conversation_held": false,
  "asked_for_meeting": false,
  "meeting_booked": false,
  "objection_details": ""
}
```

**Why:** This is the connected flow data. When a rep marks "Connected", they fill in how far the conversation progressed. This data feeds the 7-rate debrief funnel and is the only way to compute conversation quality stats (Intro→Conversation rate, Conversation→Ask rate, Ask→Meeting rate). Without it, we only know Dial→Connect and Connect→Meeting — flat data.

---

### Migration 3: `research_entries` table

```sql
CREATE TABLE IF NOT EXISTS research_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL, -- denormalized: mirrors contacts.company
  level TEXT NOT NULL CHECK (level IN ('contact', 'company')),
  category TEXT NOT NULL CHECK (category IN (
    'news', 'pain_points', 'tech_stack', 'funding', 'general'
  )),
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_research_contact_id ON research_entries(contact_id);
CREATE INDEX idx_research_company_name ON research_entries(company_name);
CREATE INDEX idx_research_org_id ON research_entries(org_id);

ALTER TABLE research_entries ENABLE ROW LEVEL SECURITY;

-- Users can read research in their org
CREATE POLICY research_select_own_org ON research_entries
  FOR SELECT
  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- Users can create research in their org
CREATE POLICY research_insert_own_org ON research_entries
  FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

-- Users can update their own research entries
CREATE POLICY research_update_own ON research_entries
  FOR UPDATE
  USING (created_by = auth.uid());

-- Users can delete their own research entries
CREATE POLICY research_delete_own ON research_entries
  FOR DELETE
  USING (created_by = auth.uid());
```

**Design decision — denormalized `company_name`:**
There is no `companies` table. `contacts.company` is a TEXT field. Research entries use `company_name TEXT` (mirrors `contacts.company`) so that company-level research surfaces for ALL contacts at that company — when you add research at the "company" level and fill in `company_name = "TechFlow"`, it shows up when viewing any TechFlow contact. This avoids a join through a table that doesn't exist.

---

## Part 2: UI — 3-Column Session Cockpit Layout

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER: Session title | Session timer | Dial/Connect/Meeting    │
│         stats | Start/Pause/End controls                        │
├──────────────┬──────────────────────────────┬───────────────────┤
│ LEFT PANEL   │ CENTER PANEL                 │ RIGHT PANEL       │
│ w-72         │ flex-1                       │ w-80              │
│              │                              │                   │
│ Contact      │ Active Contact Card          │ Tabbed panel:     │
│ Queue        │  - Name, title, company      │ [Research]        │
│              │  - Status badge (New/Working)│ [History]         │
│ (list of     │  - Contact details           │ [Notes]           │
│  upcoming    │  - Disposition buttons       │                   │
│  contacts)   │  - Connected flow (inline)   │                   │
│              │  - Per-contact call notes    │                   │
│ Live Feed    │  - "Next Contact →" advance  │                   │
│ (session     │                              │                   │
│  event log)  │                              │                   │
└──────────────┴──────────────────────────────┴───────────────────┘
```

**Design system constraints:**
- Background: `bg-void-950` or equivalent dark surface
- Panels: glass-card treatment with `border-white/10`
- Accent: indigo-electric (`#635BFF` equivalent in VV tokens)
- Timer: `font-mono`
- Transitions: `ease-snappy`

---

## Part 3: Header Stats Bar

| Metric | Source |
|--------|--------|
| Session time (counting up) | `salesblock.actual_start` → now() |
| Per-contact timer (resets on advance) | In-memory state |
| Dials | Count of `activities` logged this session |
| Connects | Count where `outcome = 'connect'` |
| Meetings | Count where `outcome = 'meeting_booked'` |

Stats query: session-scoped read of activities (real-time). Run a Supabase `select count(*)` grouped by outcome type. Refresh on each disposition save (optimistic update is fine).

---

## Part 4: Left Panel — Contact Queue + Live Feed

### Contact Queue

- Ordered by `list_contacts.position`
- Shows upcoming contacts (not yet actioned this session)
- Each item: initials avatar, name, company, `New` or `Working` badge
  - **New**: contact has 0 activities in this org ever
  - **Working**: contact has ≥ 1 prior activity
- Clicking a queue item advances the active contact (confirm if mid-call)
- Current active contact is highlighted

### Live Feed (session event log)

Positioned below the contact queue. In-memory only — not persisted. Tracks:
- "Dialling [Name]..."
- "Logged: No Answer — [Name]"
- "Connected: [Name] — Intro Given, Asked for Meeting"
- "Advancing to [Name]..."

This is a simple chronological list built from UI events during the session. Do NOT attempt to query Supabase in real-time for this — derive it from local state mutations.

---

## Part 5: Center Panel — Active Contact + Dispositions

### Active Contact Card

```
[Avatar/Initials]  Name Surname
                   Title · Company
                   📧 email@company.com  📞 +1 555 000 000
                   [New] or [Working]
```

- Avatar: initials fallback (two-letter, colored by name hash). If `contacts.linkedin_url` is set, render profile image with initials fallback on error.
- Status badge: `New` (slate) | `Working` (indigo)

### Disposition Buttons — By Session Type

**Call dispositions:**
| Button | Keyboard | Maps to `activities.outcome` |
|--------|----------|------------------------------|
| No Answer | `1` | `no_answer` |
| Left VM | `2` | `voicemail` |
| Connected | `3` | `connect` |
| Not Interested | `4` | `not_interested` |
| Meeting Set | `5` | `meeting_booked` |
| Call Back | `6` | `follow_up` |

**Email dispositions:**
| Button | Maps to `activities.outcome` |
|--------|------------------------------|
| Sent | `other` (note: "email sent") |
| Opened | `other` (note: "email opened") |
| Replied | `connect` |
| Meeting Set | `meeting_booked` |

**Email Bounced — exception state (NOT a standard button):**
- If email hard-bounces, show a warning indicator on the contact card: amber badge "Email Bounced"
- This surfaces a contextual action strip below the contact details:
  ```
  ⚠ Email bounced  [Email Alternate Contact]  [Multithread]
  ```
- "Email Alternate Contact" → opens a task creation flow to find an alt email/contact
- "Multithread" → opens a task creation flow to identify another stakeholder at the company
- These create tasks in the `tasks` table (or a simple note on the contact) for later follow-up
- The bounced state is NOT part of the regular call flow — it's only surfaced when relevant

**Social dispositions:**
| Button | Maps to `activities.outcome` |
|--------|------------------------------|
| Viewed | `other` (note: "profile viewed") |
| Connected | `connect` |
| Message Sent | `other` (note: "message sent") |
| Replied | `connect` |
| Meeting Set | `meeting_booked` |

### Auto-Advance Behaviour

When any disposition is clicked (except "Connected" — see below):
1. Save activity to Supabase (`activities` row insert)
2. Add event to Live Feed
3. After 1.5 seconds: advance to next contact in queue
4. Reset per-contact timer

This reduces cognitive load — the rep clicks, moves on.

---

## Part 6: Connected Flow (Inline Progression Panel)

When the rep clicks "Connected" (call) or "Replied" / "Connected" (email/social):

1. Disposition is highlighted/selected
2. An inline expansion panel appears **below the disposition bar** (does NOT navigate away):

```
┌─────────────────────────────────────────────────────┐
│ Connected — How did it go?                          │
│                                                     │
│ [✓] Intro Given                                     │
│ [✓] Conversation Held                               │
│ [ ] Asked for Meeting                               │
│ [ ] Meeting Booked                                  │
│                                                     │
│ Objection Details:                                  │
│ ┌─────────────────────────────────────────────────┐ │
│ │ "Send me an email" — price not in budget...    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [Save & Next →]                [Save & Stay]        │
└─────────────────────────────────────────────────────┘
```

**"Meeting Booked" checkbox = outcome escalation.** If this is checked, the saved activity's `outcome` is upgraded to `meeting_booked` automatically. The initial "Connected" click sets `outcome = 'connect'`, but the form save replaces it with `meeting_booked` if that box is checked.

**Data saved:** `activities.progress_flags` JSONB:
```json
{
  "intro_given": true,
  "conversation_held": true,
  "asked_for_meeting": false,
  "meeting_booked": false,
  "objection_details": "Sent me an email — budget cycle ends Q3"
}
```

**"Save & Next"** → saves activity + advances to next contact
**"Save & Stay"** → saves activity, dismisses panel, stays on current contact (for immediate callback scheduling, etc.)

This is the **most critical UI feature** in the middle ground because it's the data source for all rates beyond Dial→Connect.

---

## Part 7: Per-Contact Call Notes

Below the disposition / connected flow area:

```
Call Script / Call Notes
┌─────────────────────────────────────────────────────┐
│ [Script text here — editable during session]        │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- Label switches: `session_type === 'call'` → "Call Script" (pre-session) → "Call Notes" (active session)
- For email blocks: "Email Notes"
- For social blocks: "Touch Notes"
- Saves to `salesblocks.notes` (general session notes) OR a new per-contact notes field in `activities.notes`
- Existing `activities.notes` column serves this purpose — no new column needed

---

## Part 8: Right Panel — Research / History / Notes (Tabbed)

### Tab 1: Research

Displays `research_entries` for:
1. **Contact-level** entries where `contact_id = current_contact.id`
2. **Company-level** entries where `company_name = current_contact.company` AND `level = 'company'`

Company research surfaces for ALL contacts at the same company — this is the key value of the `company_name` denormalization.

**UI:**
```
Research  [History]  [Notes]                [+ Add Research]

Company: TechFlow (3 entries)
  💰 Funding: Series B — $12M, Jan 2026 (Crunchbase)
  🔧 Tech Stack: Salesforce, Outreach, Gong
  📰 News: Hired new VP Sales — expansion signal

Contact: Mark Thompson (1 entry)
  🎯 Pain Point: "Current CRM doesn't integrate with their data warehouse"

[ + Add Company Research ]  [ + Add Contact Research ]
```

**"+ Add Research" flow:**
- Opens a small inline form (NOT a modal)
- Fields: Level (Contact / Company), Category, Content (multiline text)
- Saves to `research_entries`
- Company name auto-populated from `contacts.company`

### Tab 2: History

Chronological list of past `activities` for this contact, across all prior sessions.

```
History  [Research]  [Notes]

▸ 2026-03-05  No Answer (Call Block #441)
▸ 2026-02-28  Left VM (Call Block #438)
▸ 2026-02-20  Connected — Intro, Asked for Meeting (Call Block #432)
              "They were interested but budget locked until Q2"
```

Query: `activities WHERE contact_id = $id ORDER BY created_at DESC LIMIT 20`

Cadence indicators (if `session_type = 'call'`):
- Shows attempt count: "Attempt 3 of 7"
- Days since last contact: "Last contact: 6 days ago"

### Tab 3: Notes

General contact notes (not session-specific). This reads from `contacts.custom_fields` or a dedicated notes mechanism. Editable inline. Saves on blur.

---

## Part 9: Cadence-Based Follow-Up (Deferred for Debrief)

> **Note: Debrief section is partially deferred per RPBW — focus on active cockpit first.**

### Cadence Logic (for follow-up list in debrief)

The 7-call flow:
- A contact should receive up to 7 call attempts before being marked "low priority"
- Compute: `SELECT COUNT(*) FROM activities WHERE contact_id = $id AND type = 'call'`
- Display: "Attempt 3/7" badge on contact
- Days gap: `NOW() - MAX(created_at)` from activities

**Follow-up list in debrief:**
```
Priority Follow-ups

Mark Thompson · TechFlow          Attempt 2/7 · Last contact: 3 days ago   [Call Now]
Sarah Jenkins · Loomify           Attempt 5/7 · Last contact: 7 days ago   [Call Now]
Daniel Park   · InfraCo           Attempt 7/7 · Low Priority               [Archive]
```

**Manual "Schedule Follow-up":** A simple date picker that logs a task (`tasks` table or `activities` with type = 'note' and a future timestamp). No AI required — just "follow up in 3 days" creates a timestamped reminder task linked to the contact.

---

## Part 10: Debrief — 7-Rate Conversion Funnel

> Replaces the Stitch 3-layer funnel. Matches the original Lovable app model.

The 7 rates computed from session activities + `progress_flags`:

| Rate | Numerator | Denominator | Source |
|------|-----------|-------------|--------|
| Dial → Connect | `outcome = 'connect' OR 'meeting_booked'` | Total activities | `activities` |
| Connect → Intro | `progress_flags.intro_given = true` | Connect count | `activities.progress_flags` |
| Intro → Conversation | `progress_flags.conversation_held = true` | Intro count | `activities.progress_flags` |
| Conversation → Ask | `progress_flags.asked_for_meeting = true` | Conversation count | `activities.progress_flags` |
| Ask → Meeting | `progress_flags.meeting_booked = true` OR `outcome = 'meeting_booked'` | Ask count | `activities.progress_flags` |
| Dial → Meeting | Meeting count | Total dials | Computed |
| Connect → Meeting | Meeting count | Connect count | Computed |

**Display:** Horizontal funnel bars or vertical step visualization. Each rate shown as `X%` with absolute counts.

Example:
```
84 Dials   →   18 Connects (21%)   →   14 Intros (78%)   →   11 Conversations (79%)   →   8 Asks (73%)   →   3 Meetings (38%)

Dial→Meeting: 3.6%    Connect→Meeting: 16.7%
```

**Deferred from middle ground:**
- Sentiment icons/emojis on activity log
- AI Suggestion footer bar
- Session recording playback

**Kept in middle ground:**
- Manual "Schedule follow-up" task (next call in X days) — simple date picker, no AI

---

## Part 11: Build Order

This is the recommended implementation sequence:

### Phase 1 — DB Migrations
1. `session_type` on `salesblocks`
2. `progress_flags JSONB` on `activities`
3. `research_entries` table + RLS policies + indexes

### Phase 2 — Research Panel (Right Tab 1)
- `research-queries.ts`: fetch by contact_id + company_name
- `ResearchPanel.tsx`: company section + contact section + inline add form
- Wire into right panel as default tab

### Phase 3 — Session Type on Create Modal
- `CreateSalesBlockModal.tsx`: add session type selector (Call / Email / Social)

### Phase 4 — Inline Disposition Buttons (channel-aware)
- Disposition button set per `session_type`
- Single-click → save `activities` row → auto-advance after 1.5s
- Email bounced → warning/exception state with contextual actions
- No connected flow yet (Phase 5)

### Phase 5 — Connected Flow Inline Panel
- Triggered when "Connected" / "Replied" clicked
- Checkbox form (Intro, Conversation, Ask, Meeting)
- Objection details field
- Saves `progress_flags` JSONB + auto-upgrades outcome to `meeting_booked` if checked
- "Save & Next" / "Save & Stay"

### Phase 6 — 3-Column Layout Restructure
- Left panel: contact queue + live feed
- Center panel: active contact card + dispositions + call notes
- Right panel: tabbed (Research / History / Notes)
- Header: stats bar + session timer + per-contact timer

### Phase 7 — History Tab (Right Tab 2)
- Query past activities for contact
- Show cadence indicators (attempt X/7, days since last)
- Chronological list with outcome + notes preview

### Phase 8 — Notes Tab (Right Tab 3)
- Wire to contact notes (custom_fields or dedicated field)
- Inline editable, saves on blur

### Phase 9 — Debrief Redesign
- 7-rate Lovable funnel
- Session activity log table (contact, duration, outcome, action)
- Cadence-based follow-up list (attempt count + day gaps)
- Manual "schedule follow-up in X days" task creator
- Session notes (editable, save to `salesblocks.notes`)

---

## Feature Flag: Deferred to Ideal State

These features are explicitly NOT in the middle ground:

| Feature | Reason |
|---------|--------|
| Sentiment icons/emoji on activity log | Too ambitious, requires too much data |
| AI Suggestion bar | Future AI feature |
| Call recording playback | Requires call infrastructure |
| Auto-AI research enrichment | Future AI feature |
| LinkedIn photo passthrough | Future — API complexity |
| Tier 1 Target badge | Not needed — New/Working is sufficient |

---

## Schema Summary (Middle Ground Additions)

| Object | Column/Field | Type | Purpose |
|--------|-------------|------|---------|
| `salesblocks` | `session_type` | TEXT CHECK ('call','email','social') | Drive disposition set |
| `activities` | `progress_flags` | JSONB | Connected flow checkpoints |
| `research_entries` | new table | — | Human-curated contact/company intel |

All other disposition data uses existing `activities.outcome` enum — no schema changes needed for the call disposition model itself.

---

*PRD Version 1.1 — Refined from RPBW feedback 2026-03-11*
*Covers: Middle Ground tier only. See prd.json for full story breakdown.*
