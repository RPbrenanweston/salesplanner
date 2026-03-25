# SalesBlock UI Modernisation Plan — Phase 2 (Stitch-Informed)

## Context

The initial UI modernisation delivered **3 redesigned pages** (Home, Content Armory, Analytics) plus
the new Arena page, a design system (Velocity Void tokens in Tailwind), and a theme hook
(`useTheme.ts`). A live audit + visual review of all 12 Stitch design PNGs reveals:

1. **Arena crash** — Auth guard race condition redirects to `/signin` before user state loads
2. **Dark/light toggle broken** on all redesigned pages — CSS utilities are hardcoded dark
3. **8 pages still on old gray design** — SalesBlocks, Lists, Email, Social, Pipeline, Goals, Team, Settings
4. **Stitch designs are compelling but product is flat** — rich features in mockups not wired up

---

## Stitch Design Visual Audit (All 12 PNGs Reviewed)

### Critical Finding: Dark and Light Are NOT Color Inversions

The Stitch mockups use **fundamentally different layouts** for dark vs light mode:

| Screen | Dark Theme | Light Theme |
|--------|-----------|-------------|
| Arena | "THE KILLZONE" — VS battle layout, Combat Gear stats, Reward Pool, "ACTIVATE PROTOCOL" | "War Room" — sidebar nav, Featured Duel, Top Performers revenue table, rank card |
| Command Center | Tabs (Dashboard/Deals/Momentum/Coaching), bar chart, Red Alert Deals | Sidebar nav, Squad Velocity trend line, Pipeline Heatmap, Drift Detection |
| Content Library | "Content Armory" — star ratings, conversion rates, Recent Comms table | Clean card grid with category badges (BATTLECARD, SNIPPET), Recent Uploads |
| Daily Briefing | "Pre-Flight Check" — Immediate Strikes with action CTAs, Pipeline Pulse sidebar | "Morning Launchpad" — High-Intent Leads with photos, Schedule & Tasks sidebar |
| Mission Planner | "Enterprise Outreach Alpha" — compact timeline, 5 touchpoints, stats header | "Mission Planner" — rich cards with embedded triggers, templates, battlecards |
| Research Lab | Market signals, ICP persona tabs, Competitor Void Analysis, pitch angles | Company profile ("TechNova") — firmographics, financial health, messaging hooks |

**Decision (RPBW-approved per-screen theme choices):**

We pick ONE structural layout per page and make it toggle between dark and light. The chosen
layout becomes the structural reference; the alternate theme is a color/styling toggle, not
a different layout.

| Screen | Winning Theme | Rationale |
|--------|--------------|-----------|
| **Arena** | DARK | Focus on inputs (calls, emails, activities), not $ pipeline. Volume of work = controllable in a battle. |
| **Command Center** | DARK | But reframe context: inputs over revenue. Account-level insights, in-progress deals, meetings. Suggest aims like "find multithreading opportunity." |
| **Content Library** | LIGHT | Clean card grid with category badges. Simpler, more usable. |
| **Daily Briefing** | LIGHT | "Morning Launchpad" — cleaner task/schedule focus. |
| **Mission Planner** | DARK | "Enterprise Outreach Alpha" — compact timeline, aggressive outreach feel. |
| **Research Lab** | LIGHT | Simplicity of insights wins. Needs two-mode flag: Account Research + ICP Persona Research (both manual or AI-assisted). |

Each page must work in BOTH themes (dark toggle ↔ light toggle), but the winning theme
defines the structural layout, component choices, and feature emphasis.

### Common Design Components Across All 6 Stitch Screens

These patterns appear in 3+ screens and should become shared components:

| Component | Appears In | Implementation |
|-----------|-----------|----------------|
| **KPI Stat Cards** (4-wide row with icon, value, label, trend) | All 6 screens | Existing `stat-card` class — enhance with trend arrows + sparklines |
| **Glass Cards** (frosted containers, subtle borders) | All 6 screens | Existing `glass-card` class — add dark/light variants |
| **Section Headers** (uppercase tracking-widest, icon + title) | All 6 screens | Existing `vv-section-title` — already correct pattern |
| **Data Tables** (glass wrapper, row hover, column alignment) | Arena, Command Center, Content Library | Existing pattern in Arena.tsx — extract to shared |
| **Timeline/Sequence** (vertical with day markers, type icons) | Mission Planner, Daily Briefing | NEW component — `<SequenceTimeline steps={[...]} />` |
| **Persona/Profile Cards** (avatar, role, pain points list) | Research Lab, Arena | NEW component — `<PersonaCard persona={...} />` |
| **Badge/Tag System** (colored pills: HIGH INTENT, BATTLECARD) | All 6 screens | NEW utility classes — `.badge-intent`, `.badge-category` |
| **Progress Bars** (gradient fill, percentage label) | Arena, Goals, Command Center | NEW component — `<GradientProgress value={n} />` |
| **Action CTAs** (primary indigo, ghost, destructive red) | All 6 screens | Existing button styles — standardise |

### Feature Gap Analysis: Wireable NOW vs Needs Backend

**Tier 1 — Wireable with existing Supabase data (do NOW):**

| Feature | Stitch Screen | Existing Data Source | Current Page |
|---------|--------------|---------------------|--------------|
| Pipeline velocity KPI | Command Center | `deals` table (stage + timestamps) | Analytics.tsx |
| Win rate calculation | Command Center | `deals` where stage = won / total | Analytics.tsx |
| Deal velocity bar chart | Command Center | `deals` grouped by day | Analytics.tsx |
| Leaderboard with calls/emails/deals | Arena | `activities` table (already queried) | Arena.tsx |
| Email template grid with categories | Content Library | `email_templates` table | ContentLibrary.tsx |
| Call script grid | Content Library | `call_scripts` table | ContentLibrary.tsx |
| Pipeline kanban board | Command Center | `pipeline_stages` + `deals` | Pipeline.tsx |
| Goal progress bars | Daily Briefing | `goals` table (target vs current) | Goals.tsx |
| Team member grid with roles | Arena light | `team_members` table (display_name, role) | Team.tsx |
| Contact list with search/filter | Research Lab light | `contacts` + `list_contacts` | Lists.tsx |
| SalesBlock campaign sequence view | Mission Planner | `salesblocks` + `salesblock_steps` | Salesblocks.tsx |
| Activity feed (calls, emails, pipeline moves) | Daily Briefing | `activities` table | Home.tsx |
| Upcoming salesblocks timeline | Daily Briefing | `salesblocks` where status = active | Home.tsx |

**Tier 2 — Needs NEW backend work (POSTPONE):**

| Feature | Stitch Screen | Why It Needs Backend | RPBW Decision |
|---------|--------------|---------------------|---------------|
| AI-generated pitch angles | Research Lab | Requires LLM integration (shared-ai-layer) | Future — manual with LLM assist later. Do the research manually first, LLM integration is future state. |
| Competitor analysis cards | Research Lab | No competitor data table in Supabase | Future — needs enrichment data pipeline first. |
| Company firmographics/financial health | Research Lab light | No enrichment data — needs Lead Magic API | Future — Lead Magic integration is a separate workstream. |
| Intent scoring on leads | Daily Briefing light | No intent model — needs ML pipeline | Future — no intent model exists yet. |
| "Initialize Overdrive" gamification mode | Arena dark | Complex real-time state machine | Future — too complex for now. |
| Reward Pool / currency system | Arena dark | Needs rewards table + transaction logic | Future — too complex for now. |
| VS battle matchmaking | Arena dark | Needs pairing algorithm + real-time updates | Future — will be manual by team. It's a team building exercise / sales competition. Team sets up matches manually. |
| Drift detection alerts | Command Center light | Needs anomaly detection on deal velocity | Future — needs anomaly detection model. |
| Auto-generated outreach sequences | Research Lab light | Requires LLM + template engine | Future — manual first, automate later. |
| Social touchpoint scripting | Mission Planner light | No LinkedIn API integration yet | Future — no LinkedIn API yet. |
| Star ratings on content | Content Library dark | No ratings table in Supabase | Future — team-led training tool. Star ratings + coaching is effectively a team training feature. AI integration is complicated, so this is future state. |
| Coaching tab in Command Center | Command Center dark | No coaching/feedback data model | Future — team-led. Coaching is a training function owned by team leads, not AI. Future state after core product is solid. |

---

## Priority 1 — Fix Arena Crash (Bug)

**Problem:** `Arena.tsx` lines 23-27 — auth guard inside `useEffect` fires before Supabase session
resolves. `user` is `null` momentarily, triggering `navigate('/signin')`. Creates redirect loop.

**File:** `frontend/src/pages/Arena.tsx`

**Fix:**
```tsx
// BEFORE (broken):
useEffect(() => {
  if (!user) {
    navigate('/signin');
    return;
  }
  loadLeaderboard();
}, [user, navigate]);

// AFTER (fixed):
// ProtectedRoute in App.tsx already handles unauthenticated redirects.
// The duplicate guard causes the race condition.
useEffect(() => {
  if (user) {
    loadLeaderboard();
  }
}, [user]);
```

**Also check:** Home.tsx, Analytics.tsx, ContentLibrary.tsx for the same anti-pattern.

**Verify:** Navigate to `/arena` while logged in. No redirect flash. Leaderboard loads.

---

## Priority 2 — Fix Dark/Light Mode Toggle

**Problem:** Redesigned pages use hardcoded dark classes (`bg-void-950`, `text-white`) with no
`dark:` variants. The theme hook works but nothing responds to it.

### Layer 1: CSS Utilities (`src/index.css`)

```css
.vv-page {
  @apply min-h-screen font-sans
    bg-gray-50 text-gray-900
    dark:bg-void-950 dark:text-white;
}

.glass-card {
  @apply backdrop-blur-md rounded-xl
    bg-white border border-gray-200 shadow-sm
    dark:bg-white/5 dark:border-white/10 dark:shadow-none;
}

.stat-card {
  @apply glass-card p-5 flex flex-col gap-2;
}

.vv-section-title {
  @apply text-xs font-semibold uppercase tracking-widest
    text-gray-500
    dark:text-white/40;
}

.glass {
  @apply backdrop-blur-md
    bg-white/80 border border-gray-200
    dark:bg-white/5 dark:border-white/10;
}

/* NEW utility classes from Stitch audit */
.neon-glow-indigo {
  @apply dark:shadow-[0_0_20px_rgba(99,102,241,0.4)];
}
.neon-glow-cyan {
  @apply dark:shadow-[0_0_20px_rgba(13,185,242,0.4)];
}
```

### Layer 2: Page Components — Replacement Table

| Hardcoded Dark | Replace With |
|---|---|
| `bg-void-950` | `bg-gray-50 dark:bg-void-950` |
| `bg-void-900` | `bg-white dark:bg-void-900` |
| `bg-void-900/40` | `bg-gray-100 dark:bg-void-900/40` |
| `bg-void-900/80` | `bg-gray-50 dark:bg-void-900/80` |
| `bg-void-800` | `bg-gray-50 dark:bg-void-800` |
| `text-white` (as primary text) | `text-gray-900 dark:text-white` |
| `text-white/60` | `text-gray-500 dark:text-white/60` |
| `text-white/80` | `text-gray-600 dark:text-white/80` |
| `text-white/40` | `text-gray-400 dark:text-white/40` |
| `text-white/30` | `text-gray-300 dark:text-white/30` |
| `border-white/5` | `border-gray-200 dark:border-white/5` |
| `border-white/10` | `border-gray-200 dark:border-white/10` |
| `bg-white/5` | `bg-gray-100 dark:bg-white/5` |
| `bg-white/10` | `bg-gray-200 dark:bg-white/10` |
| `hover:bg-white/5` | `hover:bg-gray-100 dark:hover:bg-white/5` |
| `bg-void-950/50` | `bg-white/80 dark:bg-void-950/50` |
| `text-cyan-neon` | stays (works on both backgrounds) |
| `text-indigo-electric` | stays |

**Files to modify:**
- `src/index.css` — Utility classes
- `src/pages/Home.tsx` — Light variants
- `src/pages/Analytics.tsx` — Light variants
- `src/pages/Arena.tsx` — Light variants
- `src/pages/ContentLibrary.tsx` — Light variants

**Verify:** Toggle theme. All 4 pages switch cleanly. No white-on-white or dark-on-dark.

---

## Priority 3 — Modernise AppLayout Sidebar

**Problem:** AppLayout uses old gray design while page content is Velocity Void.

**File:** `frontend/src/components/AppLayout.tsx`

**Changes:**
- Sidebar bg: `bg-gray-50 dark:bg-gray-900` -> `bg-white dark:bg-void-950`
- Nav hover: old gray -> `hover:bg-gray-100 dark:hover:bg-white/5`
- Active nav: old blue -> `bg-indigo-50 text-indigo-electric dark:bg-indigo-electric/10`
- Borders: `border-gray-200 dark:border-gray-700` -> `border-gray-200 dark:border-white/10`
- Top bar: same treatment

**Stitch reference:** The light Stitch mockups show a clean left sidebar with:
- Icon + text nav items
- Active item has colored left border accent
- Bottom section: user avatar + settings gear

**Verify:** Sidebar matches Velocity Void in dark, clean modern look in light.

---

## Priority 4 — Redesign Remaining 8 Pages (Stitch-Informed)

Each page below includes the Stitch gap analysis — what the mockups show vs what exists,
and what's wireable NOW vs needs backend later.

### 4A — Pipeline (`/pipeline`) — Maps to "Command Center" DARK Stitch screen

**File:** `src/pages/Pipeline.tsx`
**Current:** Basic kanban board with `@hello-pangea/dnd` drag-and-drop.
**Winning theme:** DARK — but reframed around **inputs not revenue**. The Stitch dark mockup
shows $4.2M pipeline / win rate — we replace revenue-centric KPIs with **activity-centric** ones:
calls logged, emails sent, meetings booked, deals touched this week. Account-level insights
surface in-progress deals and meetings, with suggested aims like "find multithreading opportunity
at [account]" based on single-threaded deals (only one contact linked).

**Wireable NOW:**
- KPI cards (input-focused): calls this week, emails this week, meetings booked, deals touched
  (all from `activities` table grouped by type + date range)
- Account-level insights: deals with only 1 contact → "multithreading opportunity" suggestion
  (join `deals` → `contacts` via deal_id, count contacts per deal)
- Kanban columns: already have `pipeline_stages` + `deals` data
- Deal cards: glass-card with value, stage, days-in-stage, contact count badge
- Stalled deals highlight: deals where `updated_at` > 14 days ago

**Postpone:** Coaching tab, Drift Detection, forecasting model, revenue-based KPIs (add later as secondary view).

### 4B — Goals (`/goals`)

**File:** `src/pages/Goals.tsx`
**Current:** Basic goal cards with plain progress indicators.
**Stitch vision (from Daily Briefing):** Goal progress bars with gradient fills, percentage labels,
target vs actual numbers, due date indicators.

**Wireable NOW:**
- Goal cards: `goals` table already has target, current, type fields
- Progress bars: `current / target * 100` — use gradient from indigo-electric to cyan-neon
- Due date badges: compare `due_date` to today

**Postpone:** AI-suggested goals, team goal aggregation.

### 4C — SalesBlocks (`/salesblocks`) — Maps to "Mission Planner" Stitch screens

**File:** `src/pages/Salesblocks.tsx`
**Current:** List view with campaign toggle. Already has 4-step sequence builder.
**Stitch vision:** Vertical timeline with rich cards per touchpoint, each showing day number,
channel type (email/phone/LinkedIn), template preview, trigger conditions. Stats header
(prospects, duration, steps, reply rate).

**Wireable NOW:**
- Timeline layout: `salesblock_steps` ordered by `step_order`, show `step_type` + `delay_days`
- Stats header: count contacts in salesblock, count steps, calculate duration from delays
- Step cards: glass-card with channel icon, day marker, template reference
- "Add Touchpoint" button: existing step creation modal

**Postpone:** Embedded battlecards in steps, test run simulation, LinkedIn touchpoint automation.

### 4D — Lists (`/lists`) — Maps to "Research Lab Light" Stitch screen

**File:** `src/pages/Lists.tsx`
**Current:** Basic contact list table.
**Winning theme:** LIGHT — simplicity of insights wins.

**Two-Mode Research Flag (RPBW requirement):**

This page serves two distinct research workflows, toggled by a mode selector:

| Mode | Purpose | Example | Data Flow |
|------|---------|---------|-----------|
| **Account Research** | Deep-dive on a single company, research populates across all contacts within that account | Researching HSBC → findings apply to 15-20 prospects at HSBC | `contacts` filtered by `company` field |
| **ICP Persona Research** | Research a persona type across multiple accounts, findings apply to all matching contacts | VP Engineering pain points → applies across 15-20 accounts | `contacts` filtered by `title`/`role` field |

Both modes support **manual** (user writes notes/insights) or **AI-assisted** (future state — LLM
generates research summaries). For now, implement manual mode with a UI hook for AI-assisted later.

**Wireable NOW:**
- Mode toggle: Account Research / ICP Persona Research (tab or segmented control)
- Contact list table: `lists` + `list_contacts` + `contacts` data
- Glass-card wrapper, modern row hover, search/filter bar
- Account Research view: group contacts by company, show company header card
- ICP Persona view: group contacts by title/role, show persona header card
- Contact detail panel: name, email, company, phone from `contacts` table
- Research notes area: text field per account or persona (store in `contacts` metadata or new column)
- List CRUD: create/rename/delete lists

**Postpone:** AI-assisted research (LLM integration), company enrichment (firmographics, funding),
intent signals, competitor analysis cards.

### 4E — Email (`/email`)

**File:** `src/pages/Email.tsx`
**Current:** Basic email compose/inbox view.
**Stitch reference:** Content Library shows email templates with conversion rates and categories.

**Wireable NOW:**
- Glass-card panels for compose and inbox
- Template picker: pull from `email_templates` table
- Modern table styling for message list

**Postpone:** Gmail/Outlook OAuth integration (env vars empty), send tracking, open rates.

### 4F — Social (`/social`)

**File:** `src/pages/Social.tsx`
**Current:** Basic social feed/compose.
**Stitch reference:** Mission Planner shows LinkedIn touchpoint cards.

**Wireable NOW:**
- Glass-card feed layout with platform indicator icons
- Compose area with glass input styling

**Postpone:** LinkedIn API, social scheduling, engagement tracking.

### 4G — Team (`/team`) — Maps to "Arena Light" Stitch screen

**File:** `src/pages/Team.tsx`
**Current:** Basic team member list.
**Stitch vision (Arena light):** Team member cards in a grid with avatar, name, role. KPI
sidebar showing team velocity metrics.

**Wireable NOW:**
- Team grid: `team_members` table (display_name, role, avatar_url)
- Glass-card member cards with avatar placeholder, role badge
- Invite CTA: indigo-electric button

**Postpone:** Per-member performance stats, coaching suggestions, team velocity aggregation.

### 4H — Settings (`/settings`)

**File:** `src/pages/Settings.tsx`
**Current:** Basic settings form.
**No direct Stitch mockup.** Use general Velocity Void patterns.

**Wireable NOW:**
- Glass-card section panels for each settings group
- Void-styled form inputs with focus rings (indigo-electric)
- Save button: indigo-electric primary

---

## Priority 5 — Auth Pages Polish (Optional)

SignIn, SignUp, ForgotPassword, ResetPassword — cosmetic only. Low priority.
Apply minimal Velocity Void: void gradient background, glass-card form container.

---

## Navigation Requirements (RPBW requirement)

All page paths must be navigable from the sidebar. No dead-end routes.

**SalesBlock Logo → Home:** Clicking the SalesBlock logo/brand mark in the sidebar or top bar
navigates to `/` (home dashboard) from ANY page. This must be wired in `AppLayout.tsx` as a
`<Link to="/">` wrapping the logo element.

**Sidebar Nav Items:** Every route in the app must have a corresponding sidebar link:

| Route | Sidebar Label | Icon |
|-------|--------------|------|
| `/` | Home | Home/Dashboard |
| `/pipeline` | Pipeline | Kanban/Layers |
| `/arena` | Arena | Trophy |
| `/salesblocks` | SalesBlocks | Zap/Blocks |
| `/lists` | Lists | Users/List |
| `/email` | Email | Mail |
| `/social` | Social | Share2 |
| `/content` | Content | FileText/Library |
| `/analytics` | Analytics | BarChart3 |
| `/goals` | Goals | Target |
| `/team` | Team | Users |
| `/settings` | Settings | Settings |

**Verify:** Click every sidebar link — page loads. Click logo from every page — returns to home.

---

## Execution Order

| Step | Scope | Files |
|------|-------|-------|
| 1 | Arena crash fix | Arena.tsx |
| 2 | CSS utility dark/light variants | index.css |
| 3 | Home.tsx dark/light | Home.tsx |
| 4 | Analytics.tsx dark/light | Analytics.tsx |
| 5 | Arena.tsx dark/light | Arena.tsx |
| 6 | ContentLibrary.tsx dark/light | ContentLibrary.tsx |
| 7 | AppLayout sidebar modernise | AppLayout.tsx |
| 8 | Pipeline redesign (Stitch Command Center) | Pipeline.tsx |
| 9 | Goals redesign | Goals.tsx |
| 10 | SalesBlocks restyle (Stitch Mission Planner) | Salesblocks.tsx |
| 11 | Lists redesign (Stitch Research Lab light) | Lists.tsx |
| 12 | Email redesign | Email.tsx |
| 13 | Social redesign | Social.tsx |
| 14 | Team redesign (Stitch Arena light) | Team.tsx |
| 15 | Settings redesign | Settings.tsx |
| 16 | Auth pages polish (optional) | SignIn.tsx, SignUp.tsx |

---

## Verification Checklist

1. `npm run build` — zero TypeScript errors
2. Every route loads without console errors
3. Theme toggle works on EVERY page (dark <-> light)
4. No hardcoded `bg-void-*` or `text-white` without `dark:` prefix
5. Sidebar + top bar match Velocity Void design system
6. Arena loads without redirect flash
7. All Supabase data queries still work
8. Visual consistency: all pages use glass-card, neon accents, Space Grotesk headings
9. Stitch Tier 1 features (wireable NOW) are integrated where data exists

---

## Stitch Mockup Reference

| Mockup | Path |
|--------|------|
| Arena Dark | `_designs/stitch_salesblock_ux_ui/the_arena_dark_mode/screen.png` |
| Arena Light | `_designs/stitch_salesblock_ux_ui/the_arena_light_mode/screen.png` |
| Command Center Dark | `_designs/stitch_salesblock_ux_ui/velocity_void_command_center_dark/screen.png` |
| Command Center Light | `_designs/stitch_salesblock_ux_ui/velocity_void_command_center_light/screen.png` |
| Content Library Dark | `_designs/stitch_salesblock_ux_ui/velocity_void_content_library_dark/screen.png` |
| Content Library Light | `_designs/stitch_salesblock_ux_ui/velocity_void_content_library_light/screen.png` |
| Daily Briefing Dark | `_designs/stitch_salesblock_ux_ui/velocity_void_daily_briefing_dark/screen.png` |
| Daily Briefing Light | `_designs/stitch_salesblock_ux_ui/velocity_void_daily_briefing_light/screen.png` |
| Mission Planner Dark | `_designs/stitch_salesblock_ux_ui/velocity_void_mission_planner_dark/screen.png` |
| Mission Planner Light | `_designs/stitch_salesblock_ux_ui/velocity_void_mission_planner_light/screen.png` |
| Research Lab Dark | `_designs/stitch_salesblock_ux_ui/velocity_void_research_lab_dark/screen.png` |
| Research Lab Light | `_designs/stitch_salesblock_ux_ui/velocity_void_research_lab_light/screen.png` |

## Critical Files

| File | Purpose |
|---|---|
| `frontend/src/index.css` | CSS utility classes — add light variants |
| `frontend/tailwind.config.js` | Design tokens (already configured) |
| `frontend/src/hooks/useTheme.ts` | Theme toggle hook (already working) |
| `frontend/src/components/AppLayout.tsx` | Sidebar + top bar — modernise |
| `frontend/src/pages/Home.tsx` | Redesigned, needs light mode |
| `frontend/src/pages/Analytics.tsx` | Redesigned, needs light mode |
| `frontend/src/pages/Arena.tsx` | Crash fix + light mode |
| `frontend/src/pages/ContentLibrary.tsx` | Redesigned, needs light mode |
| `frontend/src/pages/Pipeline.tsx` | Full redesign (Stitch: Command Center) |
| `frontend/src/pages/Goals.tsx` | Full redesign |
| `frontend/src/pages/Salesblocks.tsx` | Restyle (Stitch: Mission Planner) |
| `frontend/src/pages/Lists.tsx` | Full redesign (Stitch: Research Lab light) |
| `frontend/src/pages/Email.tsx` | Full redesign |
| `frontend/src/pages/Social.tsx` | Full redesign |
| `frontend/src/pages/Team.tsx` | Full redesign (Stitch: Arena light) |
| `frontend/src/pages/Settings.tsx` | Full redesign |
