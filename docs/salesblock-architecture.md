# SalesBlock Planning & Productivity Architecture

## Context

This plan translates the 82 Schema C Breadcrumbs from Super Productivity into a concrete React 18 + Supabase architecture for SalesBlock's planning and productivity features. It covers the "adapt" breadcrumbs (features to rewrite in React) and the key "pattern" breadcrumbs (architectural inspiration). Derived from `docs/schema-c-breadcrumbs.md`.

**Stack:** React 18, TypeScript 5.3, Vite, TanStack Query, Zustand (local UI state), Tailwind, Shadcn/ui, Supabase (Postgres + RLS + Realtime)

---

## 1. SUPABASE SCHEMA

### 1.1 Core Tables

```sql
-- Sales blocks: the atomic unit (replaces SP "Task")
-- Breadcrumbs: 3.1, 3.2, 2.1
CREATE TABLE sales_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('call','email','linkedin','meeting','research','admin','break')),
  title TEXT NOT NULL,
  description TEXT,
  contact_id UUID,                    -- linked contact
  deal_id UUID,                       -- linked deal
  cadence_id UUID,                    -- parent cadence (P2-003)
  duration_estimate_ms INT NOT NULL DEFAULT 1800000, -- 30min default
  duration_actual_ms INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','paused','completed','skipped')),
  scheduled_date DATE,                -- which day (SP: dueDay)
  start_time TIMESTAMPTZ,             -- exact start (SP: dueWithTime)
  end_time TIMESTAMPTZ,
  sort_order INT DEFAULT 0,           -- within day plan
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Day plans: date->block[] mapping (replaces SP PlannerState)
-- Breadcrumbs: 2.1, 2.2, 2.3
CREATE TABLE day_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  plan_date DATE NOT NULL,
  block_order UUID[] DEFAULT '{}',    -- ordered list of sales_block IDs
  notes TEXT,                         -- day-level notes
  briefing_completed BOOLEAN DEFAULT FALSE,  -- P1-008 morning briefing done
  debrief_completed BOOLEAN DEFAULT FALSE,   -- P1-009 daily debrief done
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_date)
);

-- Focus sessions: timer session log (replaces SP FocusModeState persistence)
-- Breadcrumbs: 1.5, 1.6, 1.7, 7.1
CREATE TABLE focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  sales_block_id UUID REFERENCES sales_blocks(id),
  mode TEXT NOT NULL CHECK (mode IN ('pomodoro','flowtime','countdown','sprint')),
  state TEXT NOT NULL DEFAULT 'idle' CHECK (state IN ('idle','running','paused','break','completed')),
  duration_target_ms INT,             -- NULL for flowtime
  duration_actual_ms INT DEFAULT 0,
  cycle_number INT DEFAULT 1,         -- pomodoro cycle
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  break_count INT DEFAULT 0,
  break_time_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule config: work hours & breaks (replaces SP ScheduleConfig)
-- Breadcrumbs: 2.10, 1.9
CREATE TABLE user_schedule_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  work_start_hour INT DEFAULT 8,      -- 8am
  work_end_hour INT DEFAULT 18,       -- 6pm
  lunch_start_hour INT DEFAULT 12,
  lunch_duration_min INT DEFAULT 60,
  sprint_duration_ms INT DEFAULT 5400000,  -- 90min (P1-002)
  break_duration_ms INT DEFAULT 900000,    -- 15min
  pomodoro_work_ms INT DEFAULT 1500000,    -- 25min
  pomodoro_short_break_ms INT DEFAULT 300000,  -- 5min
  pomodoro_long_break_ms INT DEFAULT 900000,   -- 15min
  pomodoro_cycles_before_long INT DEFAULT 4,
  timezone TEXT DEFAULT 'America/New_York',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar events: external calendar integration (replaces SP CalendarIntegration)
-- Breadcrumbs: 13.1, 13.2, 8.9
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  external_id TEXT,                   -- Google/Outlook event ID
  provider TEXT CHECK (provider IN ('google','outlook','ical')),
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT FALSE,
  is_blocking BOOLEAN DEFAULT TRUE,   -- reduces available hours
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session debrief: end-of-day review data (replaces SP worklog + finish-day)
-- Breadcrumbs: 2.14, 2.15, 11.5, 7.5
CREATE TABLE session_debriefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  debrief_date DATE NOT NULL,
  blocks_planned INT DEFAULT 0,
  blocks_completed INT DEFAULT 0,
  blocks_skipped INT DEFAULT 0,
  total_focus_ms INT DEFAULT 0,
  total_break_ms INT DEFAULT 0,
  wins TEXT,                          -- what went well
  improvements TEXT,                  -- what to improve
  tomorrow_priorities TEXT,           -- carry-forward notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, debrief_date)
);

-- Activity counters: simple dispositions (replaces SP SimpleCounter)
-- Breadcrumbs: 11.4
CREATE TABLE activity_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  counter_date DATE NOT NULL,
  dials INT DEFAULT 0,
  connects INT DEFAULT 0,
  emails_sent INT DEFAULT 0,
  linkedin_messages INT DEFAULT 0,
  meetings_booked INT DEFAULT 0,
  proposals_sent INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, counter_date)
);

-- CRM connections: provider registry (replaces SP IssueProvider)
-- Breadcrumbs: 8.1, 8.2, 8.3, 8.10
CREATE TABLE crm_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('salesforce','hubspot','pipedrive','close','custom')),
  credentials_encrypted JSONB,        -- encrypted OAuth tokens
  config JSONB DEFAULT '{}',          -- provider-specific settings
  sync_enabled BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 RLS Policies (all tables)
```sql
-- Every table: users can only access their own data
ALTER TABLE sales_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON sales_blocks
  FOR ALL USING (auth.uid() = user_id);
-- Repeat for all tables above
```

### 1.3 Supabase RPC for Atomic Multi-Entity Updates
```sql
-- Breadcrumb 16.2: SP uses meta-reducers for atomic multi-entity changes
-- SalesBlock uses Supabase RPC to wrap multiple updates in a transaction

CREATE OR REPLACE FUNCTION complete_sales_block(
  p_block_id UUID,
  p_actual_ms INT,
  p_counter_field TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Update the sales block
  UPDATE sales_blocks
  SET status = 'completed', duration_actual_ms = p_actual_ms,
      completed_at = NOW(), updated_at = NOW()
  WHERE id = p_block_id;

  -- Increment activity counter if specified
  IF p_counter_field IS NOT NULL THEN
    INSERT INTO activity_counters (user_id, counter_date)
    SELECT user_id, scheduled_date FROM sales_blocks WHERE id = p_block_id
    ON CONFLICT (user_id, counter_date) DO NOTHING;

    EXECUTE format(
      'UPDATE activity_counters SET %I = %I + 1, updated_at = NOW()
       WHERE user_id = (SELECT user_id FROM sales_blocks WHERE id = $1)
       AND counter_date = (SELECT scheduled_date FROM sales_blocks WHERE id = $1)',
      p_counter_field, p_counter_field
    ) USING p_block_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 2. REACT HOOKS ARCHITECTURE

### 2.1 useTimer -- Focus Timer State Machine
**Breadcrumbs:** 1.5 (FocusModeModel), 1.6 (FocusModeService), 1.7 (FocusModeReducer)

SP's timer is a 5-state machine (idle->running->paused->break->completed) with 3 modes (Pomodoro/Flowtime/Countdown). SalesBlock adds a 4th mode: Sprint (90-min blocks, P1-002).

```
State machine: idle -> running -> paused -> running (resume)
                              -> completed -> break -> idle (next cycle)
                              -> completed -> idle (done)
```

**Hook:** `src/hooks/useTimer.ts`
- Internal: `useReducer` for state machine (mirrors SP's focus-mode.reducer)
- Timer tick: `useEffect` with `setInterval(1000)` (mirrors SP's globalInterval$)
- Persistence: on state change, upsert to `focus_sessions` via TanStack mutation
- Audio/notifications: `useEffect` side effects (mirrors SP's focus-mode.effects)
- Returns: `{ state, elapsed, remaining, progress, mode, cycle, start, pause, resume, complete, cancel, startBreak, skipBreak }`

**Timer Reducer Actions:**
| Action | From State | To State | Side Effects |
|--------|-----------|----------|-------------|
| START | idle | running | Create focus_session row, start interval |
| TICK | running | running (or completed if elapsed >= target) | Update elapsed, batch-persist every 30s |
| PAUSE | running | paused | Clear interval, persist |
| RESUME | paused | running | Restart interval |
| COMPLETE | running | completed | Stop interval, persist final elapsed |
| START_BREAK | completed | break | Start break timer, increment cycle (pomodoro) |
| SKIP_BREAK | break | idle | Reset for next session |
| CANCEL | any | idle | Clear all state |

**Mode-Specific Behavior:**
| Mode | Duration | Auto-Break | Auto-Next | Break Pattern |
|------|----------|-----------|-----------|---------------|
| Pomodoro | 25min (configurable) | Yes | Yes | 5min short, 15min long every 4 cycles |
| Flowtime | Infinite (count up) | No | No | None |
| Countdown | User-set | No | No | None |
| Sprint | 90min (configurable) | Yes (after sprint) | No | 15min after each sprint |

### 2.2 useDayPlan -- Day Planner
**Breadcrumbs:** 2.1 (PlannerModel), 2.2 (PlannerService), 2.3 (PlannerReducer)

```
Hook: src/hooks/useDayPlan.ts
- TanStack Query: fetches day_plans + sales_blocks for a given date
- Mutations: addBlock, removeBlock, reorderBlocks, updateBlock
- Optimistic updates with rollback (mirrors SP's LocalActions pattern, breadcrumb 16.4)
- Drag-drop reorder updates block_order[] array in day_plans
```

**Query Key Structure:**
```typescript
['day-plan', userId, dateStr]     // day_plans row
['sales-blocks', userId, dateStr] // sales_blocks for date
['schedule', userId, dateStr]     // computed schedule (derived)
```

**Mutations:**
```typescript
addBlock(block: NewSalesBlock) -> {
  onMutate: optimistically add to cache
  mutationFn: INSERT sales_block + UPDATE day_plans.block_order
  onError: rollback cache
}

reorderBlocks(blockIds: UUID[]) -> {
  onMutate: update block_order in cache
  mutationFn: UPDATE day_plans SET block_order = $1
  onError: rollback
}
```

### 2.3 useSchedule -- Available Hours Calculation
**Breadcrumbs:** 2.8 (ScheduleModel), 2.9 (ScheduleService), 2.10 (ScheduleConfig)

SP computes "available hours" by subtracting calendar events and completed blocks from the workday window. This is the most important algorithm to adapt.

```
Hook: src/hooks/useSchedule.ts
Inputs: date, user_schedule_config, calendar_events[], sales_blocks[]
Output: {
  totalWorkMs: number,           -- work_end - work_start - lunch
  scheduledMs: number,           -- sum of planned block durations
  completedMs: number,           -- sum of completed block durations
  availableMs: number,           -- totalWork - scheduled - calendar_blocking
  calendarBlockingMs: number,    -- sum of blocking calendar events
  timelineEntries: TimelineEntry[] -- merged sorted list for rendering
}
```

**Available Hours Algorithm:**
```typescript
function computeAvailableHours(
  config: UserScheduleConfig,
  calendarEvents: CalendarEvent[],
  salesBlocks: SalesBlock[],
  date: Date
): ScheduleResult {
  // 1. Work window
  const workStartMs = setHours(date, config.work_start_hour).getTime();
  const workEndMs = setHours(date, config.work_end_hour).getTime();
  const totalWorkMs = workEndMs - workStartMs;

  // 2. Subtract lunch
  const lunchMs = config.lunch_duration_min * 60 * 1000;
  const netWorkMs = totalWorkMs - lunchMs;

  // 3. Subtract blocking calendar events (overlap-aware)
  const blockingEvents = calendarEvents.filter(e => e.is_blocking);
  const calendarBlockingMs = computeNonOverlappingDuration(
    blockingEvents, workStartMs, workEndMs
  );

  // 4. Subtract planned blocks
  const scheduledMs = salesBlocks
    .filter(b => b.status !== 'completed' && b.status !== 'skipped')
    .reduce((sum, b) => sum + b.duration_estimate_ms, 0);

  const completedMs = salesBlocks
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + b.duration_actual_ms, 0);

  // 5. Available = net work - calendar blocking - scheduled
  const availableMs = Math.max(0, netWorkMs - calendarBlockingMs - scheduledMs);

  // 6. Build timeline entries (sorted by time)
  const timelineEntries = buildTimelineEntries(
    config, calendarEvents, salesBlocks, date
  );

  return { totalWorkMs: netWorkMs, scheduledMs, completedMs, availableMs,
           calendarBlockingMs, timelineEntries };
}
```

**Timeline Entry Types:**
```typescript
type TimelineEntry =
  | { type: 'work-window'; startMs: number; endMs: number }
  | { type: 'lunch'; startMs: number; endMs: number }
  | { type: 'calendar-event'; event: CalendarEvent }
  | { type: 'sales-block'; block: SalesBlock }
  | { type: 'available-slot'; startMs: number; endMs: number };
```

### 2.4 useMorningBriefing -- Pre-Flight Briefing
**Breadcrumbs:** 2.12 (PlanningMode), 2.13 (AddTasksForTomorrow), 1.4 (FocusModeTaskPrep)

```
Hook: src/hooks/useMorningBriefing.ts
- Checks if today's day_plan has briefing_completed=false
- Suggests: overdue follow-ups, cadence steps due, carry-forward blocks
- Wizard steps: Review -> Prioritize -> Commit
- On complete: sets briefing_completed=true
```

**Wizard Flow:**
```
Step 1: REVIEW
  - Show yesterday's incomplete blocks (carry-forward candidates)
  - Show overdue follow-ups from previous days
  - Show cadence steps due today (P2-003)
  - User checks which to include today

Step 2: PRIORITIZE
  - Drag-drop to reorder selected blocks
  - Assign time estimates
  - See available hours bar update in real-time

Step 3: COMMIT
  - Confirm today's plan
  - Creates/updates day_plan with block_order
  - Sets briefing_completed=true
  - Navigates to DayPlannerPage
```

### 2.5 useDailyDebrief -- End-of-Day Review
**Breadcrumbs:** 2.14 (FinishDay), 2.15 (BeforeFinishDay), 11.5 (Worklog)

```
Hook: src/hooks/useDailyDebrief.ts
- Triggers: manual or when user navigates away after work_end_hour
- Collects: blocks completed/skipped, total focus time, activity counters
- Prompts: wins, improvements, tomorrow priorities
- Saves to session_debriefs table
- On complete: sets debrief_completed=true on day_plan
```

**Auto-Collected Metrics (from today's data):**
```typescript
{
  blocks_planned: day_plan.block_order.length,
  blocks_completed: sales_blocks.filter(s => s.status === 'completed').length,
  blocks_skipped: sales_blocks.filter(s => s.status === 'skipped').length,
  total_focus_ms: focus_sessions.reduce((s, f) => s + f.duration_actual_ms, 0),
  total_break_ms: focus_sessions.reduce((s, f) => s + f.break_time_ms, 0),
}
```

### 2.6 useBreakReminder -- Sprint Break Management
**Breadcrumbs:** 1.9 (TakeABreakConfig), 1.10 (TakeABreak)

```
Hook: src/hooks/useBreakReminder.ts
- Tracks continuous work time without break
- Triggers banner after sprint_duration_ms (90min default, P1-002)
- Actions: "Take Break" (starts break timer), "Snooze" (15min), "Already Did"
- Resets on: break taken, manual reset, idle detection
```

### 2.7 useActivityCounters -- Disposition Tracking
**Breadcrumbs:** 11.4 (SimpleCounter)

```
Hook: src/hooks/useActivityCounters.ts
- TanStack Query: fetches activity_counters for today
- Mutations: increment(field), decrement(field)
- Optimistic updates
- Used in session cockpit for quick-tap counters
```

### 2.8 useCrmAdapter -- CRM Integration Interface
**Breadcrumbs:** 8.1-8.5 (IssueModel, IssueService), 8.6-8.8 (Provider references)

```typescript
// src/types/CrmAdapter.ts
interface CrmAdapter {
  readonly providerKey: CrmProviderKey;

  // Contact operations
  getContacts(query: string): Promise<CrmContact[]>;
  getContactById(id: string): Promise<CrmContact | null>;

  // Deal operations
  getDeals(contactId?: string): Promise<CrmDeal[]>;
  getDealById(id: string): Promise<CrmDeal | null>;

  // Activity sync
  syncActivity(activity: SalesBlockActivity): Promise<void>;

  // Calendar (if provider supports it)
  getCalendarEvents?(range: DateRange): Promise<CalendarEvent[]>;

  // Connection management
  testConnection(): Promise<boolean>;
  getConnectionStatus(): ConnectionStatus;
}

type CrmProviderKey = 'salesforce' | 'hubspot' | 'pipedrive' | 'close' | 'custom';
```

**Hook:** `src/hooks/useCrmAdapter.ts`
- Reads active `crm_connections` for the user
- Instantiates the correct adapter based on `provider` field
- Exposes unified API regardless of backend CRM
- Provider implementations in `src/adapters/crm/{provider}.ts`

---

## 3. COMPONENT ARCHITECTURE

### 3.1 Page Components

```
src/pages/
+-- DayPlannerPage.tsx         -- P1-004 (breadcrumbs 2.5, 2.11)
|   +-- TimelineView           -- 7am-7pm vertical timeline
|   +-- BlockList              -- Draggable sales block rows (2.6)
|   +-- AvailableHoursBar      -- Available time indicator (2.9)
|   +-- CalendarOverlay        -- Calendar events on timeline (13.3)
|
+-- SessionCockpitPage.tsx     -- Active session view (6.4)
|   +-- TimerDisplay           -- Focus timer with progress ring (1.3)
|   +-- CurrentBlockCard       -- Active sales block details
|   +-- ActivityCounterBar     -- Quick-tap disposition counters (11.4)
|   +-- ContactPanel           -- CRM contact context (15.1)
|   +-- NotesPanel             -- Session notes (10.1)
|
+-- AnalyticsPage.tsx          -- P0-012, P2-010 (11.3)
|   +-- DailyMetricsCard       -- Today's numbers
|   +-- WeeklyTrendChart       -- 7-day trends
|   +-- ActivityBreakdown      -- Time by block_type
|
+-- MorningBriefingPage.tsx    -- P1-008 (2.12, 2.13)
|   +-- OverdueFollowUps       -- Blocks past due
|   +-- SuggestedBlocks        -- Auto-suggested from cadences
|   +-- PlanConfirmation       -- Commit today's plan
|
+-- DailyDebriefPage.tsx       -- P1-009 (2.14, 2.15)
|   +-- SessionSummary         -- Completed/skipped/time stats
|   +-- WinsAndImprovements    -- Free-text reflection
|   +-- TomorrowPriorities     -- Carry-forward
|
+-- SettingsPage.tsx           -- (12.1, 12.2, 12.3)
    +-- TimerSettings          -- Pomodoro/Sprint/Flowtime config
    +-- ScheduleSettings       -- Work hours, lunch, timezone
    +-- IntegrationSettings    -- CRM connections (8.10)
    +-- CalendarSettings       -- Calendar sync config (13.1)
```

### 3.2 Shared Components

```
src/components/
+-- CreateSalesBlockModal.tsx  -- P1-005 (breadcrumb 2.7)
|   Fields: block_type, title, duration, contact, deal, scheduled_date
|
+-- TimerWidget.tsx            -- Floating/embedded timer (1.3)
|   States: idle | counting-down | running | paused | break | completed
|   Modes: pomodoro | flowtime | countdown | sprint
|
+-- BreakReminderBanner.tsx    -- Sprint break notification (1.10)
|
+-- BlockRow.tsx               -- Draggable block in day plan (2.6)
|   Shows: type icon, title, duration, contact, status
|
+-- QuickHistoryPanel.tsx      -- Contact activity timeline (15.5)
```

---

## 4. STATE MANAGEMENT STRATEGY

**Breadcrumbs:** 16.1-16.4

| Concern | Tool | Why |
|---------|------|-----|
| Server data (blocks, plans, sessions) | TanStack Query | Caching, optimistic updates, background refetch |
| Timer UI state (elapsed, screen, mode) | Zustand store | Needs 1Hz updates, too fast for server round-trips |
| Form state | React Hook Form | Standard form handling |
| URL state (current date, view) | React Router | Standard routing |

**Key pattern from SP (breadcrumb 16.4 LocalActions):**
- Optimistic updates: mutate cache immediately, rollback on server error
- TanStack Query's `onMutate` + `onError` handles this natively

**Key pattern from SP (breadcrumb 16.2 MetaReducers):**
- Atomic multi-entity changes (e.g., completing a block updates both sales_blocks AND day_plans)
- SalesBlock equivalent: Supabase RPC function that wraps multiple updates in a transaction

---

## 5. DATA FLOW

```
User Action -> React Component -> Hook (useDayPlan/useTimer/etc.)
  +-- Local state update (Zustand for timer, TanStack cache for server data)
  +-- Supabase mutation (upsert/update)
  +-- Supabase Realtime subscription (for multi-device sync)
  +-- TanStack Query invalidation (refetch on mutation success)

Timer tick flow (1Hz):
  setInterval(1000) -> Zustand dispatch('tick') -> re-render TimerWidget
  Every 30s: batch-persist elapsed to focus_sessions (breadcrumb 7.6 BatchedTimeSync)
```

---

## 6. IMPLEMENTATION PHASES (Mapped to Roadmap Stories)

### Phase 1A: Core Timer + Day Planner (P1-001 through P1-006)
1. Supabase schema: sales_blocks, day_plans, focus_sessions, user_schedule_config
2. useTimer hook with Pomodoro/Flowtime/Sprint modes
3. useDayPlan hook with CRUD + drag-drop reorder
4. useSchedule hook with available hours calculation
5. DayPlannerPage with TimelineView
6. SessionCockpitPage with TimerDisplay
7. CreateSalesBlockModal

### Phase 1B: Briefing, Debrief, Reminders (P1-007 through P1-010)
1. useMorningBriefing + MorningBriefingPage
2. useDailyDebrief + DailyDebriefPage
3. useBreakReminder + BreakReminderBanner
4. Calendar integration (calendar_events table + useCalendar hook)
5. Follow-up reminder system

### Phase 1C: CRM Integration Foundation (P1-011 through P1-013)
1. CrmAdapter interface + provider registry
2. crm_connections table + settings UI
3. First provider adapter (Salesforce or HubSpot)

### Phase 2: Analytics + Cadences (P2-003, P2-010, P2-011)
1. activity_counters table + useActivityCounters
2. session_debriefs table + analytics aggregation
3. AnalyticsPage with charts
4. Cadence engine (recurring sales blocks)

---

## 7. KEY ARCHITECTURAL DECISIONS

| Decision | Choice | SP Breadcrumb Reference |
|----------|--------|------------------------|
| Timer state | Zustand (not server) | 1.7 -- SP uses NgRx reducer; Zustand is React equivalent for fast local state |
| Day plan persistence | TanStack Query + Supabase | 2.3 -- SP uses NgRx + IndexedDB; TQ + Supabase is React equivalent |
| Available hours | Client-side computed | 2.9 -- SP computes in service; we compute in hook from cached data |
| CRM integration | Adapter pattern with registry | 8.1-8.5 -- SP's IssueProvider pattern maps directly |
| Multi-entity updates | Supabase RPC transactions | 16.2 -- SP uses meta-reducers; Supabase RPC is equivalent |
| Optimistic updates | TanStack onMutate/onError | 16.4 -- SP uses LocalActions; TQ has this built-in |
| Timer persistence | Batched writes (every 30s) | 7.6 -- SP's BatchedTimeSyncAccumulator pattern |
| Break reminders | Client-side timer in hook | 1.9, 1.10 -- SP's TakeABreakService pattern |
