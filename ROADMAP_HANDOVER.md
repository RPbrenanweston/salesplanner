# SalesBlock.io — Feature Roadmap Handover
> Generated: 2026-03-13 | Branch: `ralph/salesblock-io` | Informed by: deep-research-report.md, positioning document, competitive landscape analysis

This document captures the feature roadmap for SalesBlock, derived from business positioning documents, competitive analysis, CRM market research, and the super-productivity-salesblock fork exploration.

---

## Product Identity

**SalesBlock is a sales productivity and execution layer** that sits on top of CRMs. Not a CRM replacement — a rep-first execution workspace.

**One-liner:** Your CRM records the work. SalesBlock helps reps do it well.

**Core differentiator:** Session-level execution design — timed environments with contact queues, scripts, activity capture, and debrief metrics. No other product combines sales-specific planning + protected focus sessions + embedded execution + auto activity capture + CRM overlay.

---

## Current State (as of March 13, 2026)

- **47/47 MVP stories complete** — full session cockpit, multi-channel outreach (Gmail/Outlook email, phone scripts, social logging), calendar integration (Google/Outlook), Salesforce integration (OAuth + bidirectional sync), pipeline kanban, analytics, goals, team leaderboard, Stripe billing
- **27 known bugs:** 10 P2 (reliability), 12 P3 (UX polish), 5 P4 (nice-to-have)
- **Tech stack:** React 18 + TypeScript 5.3 + Vite 5.1 + Supabase (PostgreSQL + Auth + RLS) + TanStack Query v5 + Tailwind 3 + Shadcn/ui + Recharts + @hello-pangea/dnd
- **Branch:** `ralph/salesblock-io` (default — no `main` branch. Do NOT create one without coordinating — it would break Vercel)
- **Super-productivity fork:** https://github.com/RPbrenanweston/super-productivity-salesblock.git (Angular 21 + NgRx + Electron — clean fork, unmodified baseline)

---

## Four Strategic Pillars

### 1. Sales-Specific Productivity Planner
Timer modes (Pomodoro 25+5, 90min sprint 90+15, Flowtime, Custom), daily planning, in-session calendar view for meeting booking.

### 2. Native CRM Integrations
Direct API integrations for control and accuracy. Attio first (dogfooding), then HubSpot, Pipedrive, Close, Dynamics. Evaluate Nango for long-tail CRMs at Phase 3.

### 3. Human-Enabled Sequencer
Guided multi-touch cadences that generate SalesBlock sessions. Never set-and-forget. Pipeline becomes self-managing: 30-day follow-ups, quarterly reviews, lapsed client blocks emerge from cadence data. Deep analytics = pipeline coaching.

### 4. Data Enrichment Layer
Clay-style waterfall enrichment with organizational guardrails. LeadMagic API for initial testing. Multi-provider cascade (Apollo, Hunter, PDL, Lusha). BYOK for ZoomInfo/Cognism. Anti-lock-in by design. TitanX/SureConnect for dial-to-connect optimization.

---

## Phase 0: Stabilization

Fix 27 bugs before shipping to real users. See `prd-prelaunch-fixes.json` for full list.

**P2 (10 items):** FIX-008 through FIX-017 — CSV import dupes, pipeline drag double-fire, BookMeeting silent failure, Stripe webhook idempotency, Salesforce sync dupes, team invite orphans, token refresh race, delete confirmations.

**P3 (5 critical):** FIX-018 through FIX-021, FIX-025

**Wire ported features:** Connect `ported-features/08-analytics-computation/` to Analytics page.

---

## Phase 1: Sales Planner + Attio Native

### Day Planner
- **Timer modes:** Pomodoro (25+5), 90-minute Sprint (90+15), Flowtime (no breaks), Custom countdown
- **Day timeline:** Draggable sales blocks, meetings overlay, break scheduling
- **Block types:** Prospecting, Follow-Up, Pipeline Review, Meeting Prep, Admin
- **Follow-up engine:** Track days since last contact, surface overdue follow-ups
- **Pre-flight briefing:** Morning view with today's blocks, overdue follow-ups, meetings, goal delta
- **Daily debrief:** Blocks completed, contacts worked, meetings booked, plan adherence
- **In-session calendar view:** Toggle week/month calendar inside session for meeting booking — "Free 2-4 Wed, Thu, until 4 Fri"

**Port from super-productivity fork:** Timer state machine logic (reimplement as React hooks), available hours calculation, day planner data model. Skip: kanban (already built), Electron, issue providers.

**New files:** `pages/DayPlanner.tsx`, `hooks/useDayPlan.ts`, `hooks/useTimer.ts`, `lib/cadence.ts`, `components/session/CalendarAvailabilityPanel.tsx`

### CRM Abstraction Layer
- `CrmAdapter` TypeScript interface: Contact, Company, Deal, Activity as common entities
- Refactor `salesforce.ts` into `lib/crm/adapters/salesforce.ts` implementing CrmAdapter
- Adapter registry: `lib/crm/registry.ts`

### Attio Native Integration (Dogfooding)
- Native OAuth 2.0 (not Nango — direct implementation for control)
- Contact sync (People records ↔ SalesBlock contacts)
- Activity push (SalesBlock activities → Attio Notes)
- Deal sync (Attio Deals ↔ Pipeline stages)
- Schema: widen `oauth_connections.provider` CHECK constraint

---

## Phase 2: HubSpot + Pipedrive + Sequencer + Cockpit 2.0

### HubSpot Native Integration
62% SMB share. Best API. Technographic GTM: detect HubSpot companies via BuiltWith → prospect them.

### Pipedrive Native Integration
SMB #3. Sales-focused user base = exact ICP.

### Human-Enabled Sequencer → Self-Managing Pipeline
- **Cadence builder:** Multi-step cadences (Day 1 Call, Day 3 Email, Day 5 LinkedIn, Day 7 Call)
- **SalesBlock auto-generation:** When enough contacts reach same cadence step (e.g., 15 follow-up emails due), suggest creating a SalesBlock session for that batch
- **Daily queue → Planner:** Morning surfaces grouped cadence tasks: "12 follow-up emails, 8 prospecting calls, 3 quarterly reviews"
- **Pipeline workflow templates:** New Prospect (8-touch), 30-Day Follow-Up, Quarterly Account Review, Lapsed Client Re-engagement, Post-Meeting Nurture
- **Pipeline coaching analytics:** Response rates by step, time-to-meeting by sequence type, re-engagement success, follow-up interval optimization. Real account metrics > clever tactics.
- **NOT set-and-forget:** No auto-send, no auto-dial. Every touch is human-executed.

### Session Cockpit 2.0
- Structured dispositions (call: dial/connect/VM; email: sent/replied)
- Connected flow (Intro → Conversation → Asked for Meeting → Booked)
- Research panel (manual entry now, AI later)
- Cadence context (where is this contact in their cadence?)
- Calendar availability panel (week/month toggle inside session)
- 7-rate debrief funnel

---

## Phase 3: Data Enrichment + Close + Dynamics + Nango Eval

### Waterfall Enrichment Engine
- **LeadMagic first** (API access available for testing)
- **Provider cascade:** LeadMagic → Apollo → Hunter → PDL → Lusha → Debounce (verification)
- **BYOK:** Customers bring own ZoomInfo/Cognism keys as premium fallback
- **Org guardrails:** Credit system, per-rep allocation, tiered autonomy, dedup guard
- **Enrichment → Pipeline analytics:** Which provider's data leads to meetings/deals → auto-optimize waterfall

### Dial-to-Connect Optimization
- TitanX or SureConnect for phone intent scoring
- Smart queue ordering by answer probability
- Connect rate tracking per provider → feedback loop
- TitanX partnership potential (acquired FrontSpin dialer Feb 2026)

### Close + Dynamics 365 Native Integrations

### Nango Evaluation Point
Evaluate for long-tail CRMs (Zoho, Freshsales, Monday, Copper) based on customer demand vs maintenance burden vs cost.

---

## Phase 4: Scale + Intelligence

- **Long-tail CRMs** via Nango or native on demand
- **AI Research** (future): LLM-powered research summaries, AI talking points in cockpit
- **Call Recording:** Partnership play (Dialpad, Aircall, RingCentral), not a build
- **Team Planner:** Manager day plan view, block assignment, coverage analysis
- **Advanced Analytics / Pipeline Coach:** Session quality scoring, planner adherence, enrichment ROI

---

## CRM Integration Priority

| # | CRM | Phase | Method | Rationale |
|---|-----|-------|--------|-----------|
| 1 | Salesforce | Done | Native | 21% market share |
| 2 | Attio | Phase 1 | Native | Dogfooding, 4x ARR growth, App Store |
| 3 | HubSpot | Phase 2 | Native | 62% SMB share, technographic GTM |
| 4 | Pipedrive | Phase 2 | Native | SMB #3, sales-focused users |
| 5 | Close | Phase 3 | Native | Inside-sales ICP |
| 6 | Dynamics 365 | Phase 3 | Native/Nango | Enterprise expansion |
| 7+ | Zoho, Freshsales, etc. | Phase 4 | Nango | On-demand |

---

## Data Enrichment Priority

| Tier | Providers | Notes |
|------|-----------|-------|
| Testing | LeadMagic | API access available now |
| Tier 1 | Apollo, Hunter | Cheap baseline, first in waterfall |
| Tier 2 | People Data Labs, Lusha | Phone + deeper data |
| Verification | Debounce/NeverBounce | Email SMTP validation |
| Phone Intent | TitanX or SureConnect | Dial-to-connect scoring |
| BYOK | ZoomInfo, Cognism, any | Customer-supplied keys, anti-lock-in |

---

## Strategic Guardrails (What NOT to Build)

1. **No set-and-forget automation** — Sequencer is human-enabled
2. **No generic task management** — Day Planner is sales-specific blocks only
3. **No CRM replacement** — Syncs WITH CRMs, doesn't replace them
4. **No manager surveillance** — Analytics serve reps first, coaching > monitoring
5. **No built-in dialer/recording** — Partnership play
6. **No LinkedIn automation** — Manual and intentional
7. **No single-vendor data lock-in** — Waterfall + BYOK by design
8. **Analytics = pipeline coaching** — Account metrics that move the needle, not vanity metrics

---

## Key Architecture Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/salesforce.ts` | Current CRM integration — refactor into adapter pattern |
| `frontend/src/types/domain.ts` | Core domain types — extend with DayPlan, TimeBlock, CrmAdapter |
| `frontend/src/pages/SalesBlockSessionPage.tsx` | Session cockpit — gets Cockpit 2.0 upgrade |
| `frontend/src/hooks/useAuth.ts` | Auth state — CRM connections depend on this |
| `supabase/migrations/` | 26 SQL migrations — add day_plans, cadences, enrichment tables |
| `frontend/src/lib/crm/` | New: CRM adapter layer (create this directory) |
| `prd-prelaunch-fixes.json` | 27 remaining bugs with priorities and file references |
| `NEXT_SESSION.md` | Detailed per-bug implementation notes |

---

## Business Documents That Informed This Roadmap

- `deep-research-report.md` — Competitive landscape, market gaps, productivity planner analysis
- `Salesblock Positioning Document.pdf` — Category definition, ICP, competitive framing, messaging pillars
- `salesblock_positioning_document.md` — Same as above, markdown version
- `SalesBlock.io competitive landscape and market gaps.pdf` — 5 competitor clusters, differentiation analysis

---

## References

- **Super-productivity fork:** https://github.com/RPbrenanweston/super-productivity-salesblock.git
- **Nango:** nango.dev — evaluate at Phase 3 for long-tail CRMs. Free tier = auth only. Growth = $50/mo + per-account/request costs.
- **Clay ecosystem:** 150+ data providers, waterfall enrichment, BYOK model
- **TitanX:** Phone intent scoring, $27M Series A Jan 2026, FrontSpin acquisition Feb 2026
- **SureConnect:** Pay-as-you-go alternative ($0.19/validation), real-time vs TitanX's 5-day turnaround
- **LeadMagic:** Available for immediate API testing
