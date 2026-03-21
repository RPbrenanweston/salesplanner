# Schema C Breadcrumbs: Super Productivity → SalesBlock Mapping

## Context

**Why this analysis:** SalesBlock.io is a sales execution platform (React 18 + Supabase) that forked Super Productivity (Angular 21 + NgRx) to study its planner, timer, and analytics patterns. The roadmap (commit `6a379b74`) defines ~115 user stories across 4 phases. This document maps every relevant Super Productivity codebase element to SalesBlock features using Schema C Breadcrumbs, and provides a definitive licensing answer.

**Super Productivity Scale:** ~172K lines of TypeScript, 231 components, 185 services, 44 feature modules, 34 reducers, 42 effects files. MIT License (c) 2018 Johannes Millan.

**SalesBlock Tech Stack:** React 18 + TypeScript 5.3 + Vite + TanStack Query + Tailwind + Shadcn/ui + Supabase. Completely different framework from Super Productivity.

---

## Licensing Verdict

**MIT License — Super Productivity is MIT licensed. Here's what that means for SalesBlock:**

| Scenario | License Required? | Action |
|----------|------------------|--------|
| **Writing new React code inspired by SP patterns/architecture** | NO | No attribution needed. Ideas, patterns, and architecture are not copyrightable |
| **Porting algorithm logic (timer state machine, available hours calc) rewritten in React** | GRAY AREA — likely NO | If substantially rewritten for React hooks (different structure, API, framework), this is a "clean room" reimplementation. No license needed |
| **Copy-pasting TypeScript functions/logic and adapting** | YES | Include MIT notice in the relevant source files or a THIRD-PARTY-NOTICES file |
| **Forking and shipping SP code directly** | YES | Full MIT notice required in distribution |

**Recommendation:** Since SalesBlock uses a completely different framework (React vs Angular), different state management (TanStack Query vs NgRx), and different persistence (Supabase vs IndexedDB), virtually all code will be **newly written**. The roadmap explicitly says "Reimplement as React hook, not Angular/NgRx." **No Super Productivity license inclusion is needed** as long as you don't copy-paste substantial code blocks. If you do port any function verbatim (e.g., a specific algorithm), add a one-line comment: `// Adapted from super-productivity (MIT) — github.com/johannesjo/super-productivity` and include the MIT notice in a NOTICES file.

---

## Schema C Breadcrumbs

### Legend
- **Breadcrumb:** `SchemaC > Domain > Category > Element`
- **SP File:** Super Productivity source file
- **SB Target:** SalesBlock story/feature it maps to
- **Port Type:** `pattern` (architectural inspiration only), `adapt` (rewrite logic in React), `reference` (study but build differently)

---

### 1. TIMER & FOCUS SYSTEM

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 1.1 | `SchemaC > Timer > Model > PomodoroConfig` | `src/app/features/config/global-config.model.ts:103-109` | P1-001 useTimer Pomodoro mode | adapt |
| 1.2 | `SchemaC > Timer > Model > FocusModeConfig` | `src/app/features/config/global-config.model.ts:218-225` | P1-001, P1-003 Flowtime mode | adapt |
| 1.3 | `SchemaC > Timer > Component > FocusModeMain` | `src/app/features/focus-mode/focus-mode-main.component.ts` | P1-001 Timer UI state machine | pattern |
| 1.4 | `SchemaC > Timer > Component > FocusModeTaskPrep` | `src/app/features/focus-mode/focus-mode-task-preparation.component.ts` | P1-008 Morning briefing pre-session prep | pattern |
| 1.5 | `SchemaC > Timer > Model > FocusModeModel` | `src/app/features/focus-mode/focus-mode.model.ts` | P1-001 Timer state machine (idle->running->paused->break->completed) | adapt |
| 1.6 | `SchemaC > Timer > Service > FocusModeService` | `src/app/features/focus-mode/store/focus-mode.service.ts` | P1-001 useTimer hook state transitions | adapt |
| 1.7 | `SchemaC > Timer > Store > FocusModeReducer` | `src/app/features/focus-mode/store/focus-mode.reducer.ts` | P1-001 Timer state management (-> useReducer in React) | adapt |
| 1.8 | `SchemaC > Timer > Store > FocusModeEffects` | `src/app/features/focus-mode/store/focus-mode.effects.ts` | P1-001 Timer side effects (audio, notifications) | pattern |
| 1.9 | `SchemaC > Timer > Config > TakeABreakConfig` | `src/app/features/config/global-config.model.ts:90-101` | P1-002 Sprint break duration config | reference |
| 1.10 | `SchemaC > Timer > Component > TakeABreak` | `src/app/features/take-a-break/` | P1-002 90-min sprint break handling | pattern |

### 2. PLANNER & SCHEDULING

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 2.1 | `SchemaC > Planner > Model > PlannerModel` | `src/app/features/planner/planner.model.ts` | P1-004, P1-006 Day Planner data model | adapt |
| 2.2 | `SchemaC > Planner > Service > PlannerService` | `src/app/features/planner/planner.service.ts` | P1-006 useDayPlan hook | adapt |
| 2.3 | `SchemaC > Planner > Store > PlannerReducer` | `src/app/features/planner/store/planner.reducer.ts` | P1-006 Day plan state (date->block[] mapping) | adapt |
| 2.4 | `SchemaC > Planner > Store > PlannerActions` | `src/app/features/planner/store/planner.actions.ts` | P1-006 Plan CRUD operations | pattern |
| 2.5 | `SchemaC > Planner > Component > PlannerPage` | `src/app/features/planner/planner-page.component.ts` | P1-004 DayPlanner.tsx layout | pattern |
| 2.6 | `SchemaC > Planner > Component > PlannerTaskRow` | `src/app/features/planner/planner-task-row.component.ts` | P1-004 Draggable time block row | pattern |
| 2.7 | `SchemaC > Planner > Component > AddPlanner` | `src/app/features/planner/add-to-planner-dialog/` | P1-005 CreateSalesBlockModal | pattern |
| 2.8 | `SchemaC > Schedule > Model > ScheduleModel` | `src/app/features/schedule/schedule.model.ts` | P1-004 Timeline SVE entries (task, calendar, workday blocks) | adapt |
| 2.9 | `SchemaC > Schedule > Service > ScheduleService` | `src/app/features/schedule/schedule.service.ts` | P1-004 Available hours calculation | adapt |
| 2.10 | `SchemaC > Schedule > Config > ScheduleConfig` | `src/app/features/config/global-config.model.ts:180-187` | P1-004 Work start/end, lunch break config | adapt |
| 2.11 | `SchemaC > Schedule > Component > ScheduleDay` | `src/app/features/schedule/schedule-day-view/` | P1-004 Day timeline 7am-7pm view | pattern |
| 2.12 | `SchemaC > Planner > Feature > PlanningMode` | `src/app/features/planning-mode/` | P1-008 Morning briefing concept | pattern |
| 2.13 | `SchemaC > Planner > Feature > AddTasksForTomorrow` | `src/app/features/add-tasks-for-tomorrow/` | P1-008 Pre-flight briefing suggested blocks | pattern |
| 2.14 | `SchemaC > Planner > Feature > FinishDay` | `src/app/features/finish-day-before-close/` | P1-009 Daily debrief trigger | pattern |
| 2.15 | `SchemaC > Planner > Feature > BeforeFinishDay` | `src/app/features/before-finish-day/` | P1-009 End-of-day review flow | pattern |

### 3. TASK MODEL -> SALES ACTIVITY MODEL

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 3.1 | `SchemaC > Task > Model > TaskModel` | `src/app/features/tasks/task.model.ts` | P1-005 SalesBlock type model (block_type, duration, contacts) | reference |
| 3.2 | `SchemaC > Task > Model > DueDateExclusivity` | `src/app/features/tasks/task.model.ts` (dueDay/dueWithTime) | P1-006 Block scheduling (start_time, end_time) | pattern |
| 3.3 | `SchemaC > Task > Service > TaskService` | `src/app/features/tasks/task.service.ts` | P1-006 useDayPlan block CRUD | pattern |
| 3.4 | `SchemaC > Task > Store > TaskReducer` | `src/app/features/tasks/store/task.reducer.ts` | P1-006 Block state management | pattern |
| 3.5 | `SchemaC > Task > Store > TaskEffects` | `src/app/features/tasks/store/task-internal.effects.ts` | P2-005 Auto-generation side effects | pattern |
| 3.6 | `SchemaC > Task > Component > TaskList` | `src/app/features/tasks/task-list-component/` | P2-006 Cadence queue list | pattern |
| 3.7 | `SchemaC > Task > Feature > TaskRepeatCfg` | `src/app/features/task-repeat-cfg/` | P2-003 Cadence step recurrence | reference |
| 3.8 | `SchemaC > Task > Feature > Reminder` | `src/app/features/reminder/` | P1-007 Follow-up cadence reminders | pattern |
| 3.9 | `SchemaC > Task > Config > ReminderConfig` | `src/app/features/config/global-config.model.ts:189-199` | P1-007 Follow-up threshold config | reference |
| 3.10 | `SchemaC > Task > Model > SubTasks` | `src/app/features/tasks/task.model.ts` (subTaskIds) | P2-012 Connected flow checklist items | pattern |

### 4. PROJECT -> CUSTOMER/ACCOUNT CONTEXT

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 4.1 | `SchemaC > Project > Model > ProjectModel` | `src/app/features/project/project.model.ts` | Domain: Customer/Account entity | reference |
| 4.2 | `SchemaC > Project > Service > ProjectService` | `src/app/features/project/project.service.ts` | Domain: Customer service layer | pattern |
| 4.3 | `SchemaC > Project > Store > ProjectReducer` | `src/app/features/project/store/project.reducer.ts` | Domain: Account state management | pattern |
| 4.4 | `SchemaC > Project > Model > BacklogTaskIds` | `src/app/features/project/project.model.ts` (backlogTaskIds) | Domain: Pipeline backlog concept | reference |
| 4.5 | `SchemaC > Project > Feature > Archive` | `src/app/features/archive/` | Domain: Closed-won/lost deal archival | pattern |

### 5. TAG -> PIPELINE STAGE / TEAM GROUPING

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 5.1 | `SchemaC > Tag > Model > TagModel` | `src/app/features/tag/tag.model.ts` | Domain: Pipeline stage labels, team tags | reference |
| 5.2 | `SchemaC > Tag > Model > VirtualTodayTag` | `src/app/features/tag/` (TODAY_TAG pattern) | P1-007 "Overdue follow-ups" virtual grouping | pattern |
| 5.3 | `SchemaC > Tag > Service > TagService` | `src/app/features/tag/tag.service.ts` | Domain: Stage/label management | pattern |

### 6. WORK CONTEXT -> SALES CONTEXT

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 6.1 | `SchemaC > WorkContext > Model > WorkContextModel` | `src/app/features/work-context/work-context.model.ts` | Domain: Sales context (current customer/pipeline view) | pattern |
| 6.2 | `SchemaC > WorkContext > Service > WorkContextService` | `src/app/features/work-context/work-context.service.ts` | Domain: Active session context switching | pattern |
| 6.3 | `SchemaC > WorkContext > Store > WorkContextReducer` | `src/app/features/work-context/store/work-context.reducer.ts` | Domain: Context state | pattern |
| 6.4 | `SchemaC > WorkContext > Feature > WorkView` | `src/app/features/work-view/` | SalesBlockSessionPage cockpit layout | pattern |
| 6.5 | `SchemaC > WorkContext > Feature > Theme` | `src/app/features/work-context/work-context.model.ts` (theme per context) | Domain: Color-coded pipeline stages | reference |

### 7. TIME TRACKING -> ACTIVITY TRACKING

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 7.1 | `SchemaC > TimeTracking > Model > TimeTrackingModel` | `src/app/features/time-tracking/time-tracking.model.ts` | P1-009 Session duration tracking | adapt |
| 7.2 | `SchemaC > TimeTracking > Service > TimeTrackingService` | `src/app/features/time-tracking/time-tracking.service.ts` | P1-009 Activity time aggregation | pattern |
| 7.3 | `SchemaC > TimeTracking > Config > TimeTrackingConfig` | `src/app/features/config/global-config.model.ts:68-78` | P1-001 Timer config (auto-start, reminders) | reference |
| 7.4 | `SchemaC > TimeTracking > Feature > TrackingReminder` | `src/app/features/tracking-reminder/` | P1-007 Follow-up tracking reminders | pattern |
| 7.5 | `SchemaC > TimeTracking > Feature > Worklog` | `src/app/features/worklog/` | P1-009, P2-010 Session history / debrief data | pattern |
| 7.6 | `SchemaC > TimeTracking > Util > BatchedTimeSync` | `src/app/features/time-tracking/` (BatchedTimeSyncAccumulator) | P1-001 Timer tick batching | adapt |

### 8. ISSUE INTEGRATION -> CRM INTEGRATION

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 8.1 | `SchemaC > Integration > Model > IssueModel` | `src/app/features/issue/issue.model.ts` | P1-011 CrmAdapter interface design | pattern |
| 8.2 | `SchemaC > Integration > Model > IssueProviderKey` | `src/app/features/issue/issue.model.ts` (BuiltInIssueProviderKey) | P1-013 CRM registry provider keys | pattern |
| 8.3 | `SchemaC > Integration > Model > IssueProviderBase` | `src/app/features/issue/issue.model.ts:203-214` | P1-011 CrmAdapter base interface | adapt |
| 8.4 | `SchemaC > Integration > Model > PluginProvider` | `src/app/features/issue/issue.model.ts` (PluginIssueProviderKey) | P3-008 BYOK provider extensibility | pattern |
| 8.5 | `SchemaC > Integration > Service > IssueService` | `src/app/features/issue/issue.service.ts` | P1-012 CRM adapter service pattern | pattern |
| 8.6 | `SchemaC > Integration > Provider > Jira` | `src/app/features/issue/providers/jira/` | P1-012 Salesforce adapter reference | reference |
| 8.7 | `SchemaC > Integration > Provider > Trello` | `src/app/features/issue/providers/trello/` | P2-001 HubSpot adapter reference | reference |
| 8.8 | `SchemaC > Integration > Provider > Linear` | `src/app/features/issue/providers/linear/` | P2-002 Pipedrive adapter reference | reference |
| 8.9 | `SchemaC > Integration > Provider > Calendar` | `src/app/features/issue/providers/calendar/` | P1-010 Calendar availability panel | adapt |
| 8.10 | `SchemaC > Integration > Store > IssueProviderState` | `src/app/features/issue/issue.model.ts:196-199` | P1-013 CRM registry state | pattern |
| 8.11 | `SchemaC > Integration > Plugin > PluginSystem` | `src/app/plugins/` | P3-008 BYOK extensible provider system | pattern |

### 9. BOARDS -> PIPELINE KANBAN

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 9.1 | `SchemaC > Boards > Feature > BoardsModule` | `src/app/features/boards/` | Pipeline.tsx kanban view | reference |
| 9.2 | `SchemaC > Boards > Component > BoardColumn` | `src/app/features/boards/` | Pipeline stage columns | pattern |

### 10. NOTES -> DEAL NOTES / RESEARCH

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 10.1 | `SchemaC > Notes > Feature > NoteModule` | `src/app/features/note/` | P2-013 Research panel notes | pattern |
| 10.2 | `SchemaC > Notes > Model > NoteModel` | `src/app/features/note/note.model.ts` | Domain: Research entry model | reference |
| 10.3 | `SchemaC > Notes > Component > NoteEditor` | `src/app/features/note/note/` | P2-013 Research note editor | pattern |

### 11. METRICS & ANALYTICS

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 11.1 | `SchemaC > Metrics > Feature > MetricModule` | `src/app/features/metric/` | P2-010, P0-012 Analytics computation | adapt |
| 11.2 | `SchemaC > Metrics > Service > MetricService` | `src/app/features/metric/metric.service.ts` | P0-012, P2-010 Sales metrics service | pattern |
| 11.3 | `SchemaC > Metrics > Component > MetricPage` | `src/app/features/metric/metric-page/` | Analytics.tsx page layout | pattern |
| 11.4 | `SchemaC > Metrics > Feature > SimpleCounter` | `src/app/features/simple-counter/` | P2-011 Disposition counters (dials, connects) | pattern |
| 11.5 | `SchemaC > Metrics > Feature > Worklog` | `src/app/features/worklog/` | P1-009, P2-015 Session debrief data | adapt |

### 12. CONFIGURATION SYSTEM

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 12.1 | `SchemaC > Config > Model > GlobalConfigState` | `src/app/features/config/global-config.model.ts:237-259` | SettingsPage.tsx config model | reference |
| 12.2 | `SchemaC > Config > Model > AppFeaturesConfig` | `src/app/features/config/global-config.model.ts:9-23` | Feature flags (planner, boards, timer modes) | pattern |
| 12.3 | `SchemaC > Config > Form > ConfigFormSection` | `src/app/features/config/global-config.model.ts:290-299` | Settings page form generation | pattern |
| 12.4 | `SchemaC > Config > Service > ConfigService` | `src/app/features/config/` | Settings persistence | pattern |

### 13. CALENDAR INTEGRATION

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 13.1 | `SchemaC > Calendar > Feature > CalendarIntegration` | `src/app/features/calendar-integration/` | P1-010 Calendar availability panel | adapt |
| 13.2 | `SchemaC > Calendar > Provider > CalendarModel` | `src/app/features/issue/providers/calendar/calendar.model.ts` | P1-010 Calendar event model | reference |
| 13.3 | `SchemaC > Calendar > Component > CalendarView` | `src/app/features/calendar-integration/` | P1-010, P3-017 Week/Month calendar views | pattern |

### 14. SYNC & PERSISTENCE (Architectural Reference)

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 14.1 | `SchemaC > Sync > Architecture > OpLog` | `src/app/op-log/` | Reference: Supabase RLS + realtime replaces this | reference |
| 14.2 | `SchemaC > Sync > Model > VectorClock` | `src/app/op-log/` | Reference: Supabase handles conflict resolution | reference |
| 14.3 | `SchemaC > Sync > Service > SyncService` | `src/app/imex/sync/` | Domain: CRM bidirectional sync patterns | reference |

### 15. UI PATTERNS

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 15.1 | `SchemaC > UI > Panels > RightPanel` | `src/app/features/right-panel/` | P2-013, P2-014 Session cockpit panels | pattern |
| 15.2 | `SchemaC > UI > Panels > BottomPanel` | `src/app/features/bottom-panel/` | Session cockpit collapsible panels | pattern |
| 15.3 | `SchemaC > UI > Panels > IssuePanel` | `src/app/features/issue-panel/` | P2-007 Cadence context badge panel | pattern |
| 15.4 | `SchemaC > UI > Navigation > MenuTree` | `src/app/features/menu-tree/` | AppLayout sidebar navigation | pattern |
| 15.5 | `SchemaC > UI > Component > QuickHistory` | `src/app/features/quick-history/` | Contact activity history | pattern |
| 15.6 | `SchemaC > UI > Feature > Shepherd` | `src/app/features/shepherd/` | Onboarding tour | pattern |
| 15.7 | `SchemaC > UI > Feature > TaskViewCustomizer` | `src/app/features/task-view-customizer/` | Session cockpit layout customization | pattern |

### 16. STATE MANAGEMENT ARCHITECTURE

| # | Breadcrumb | SP File | SB Target | Port Type |
|---|-----------|---------|-----------|-----------|
| 16.1 | `SchemaC > State > Root > RootState` | `src/app/root-store/root-state.ts` | TanStack Query cache structure | reference |
| 16.2 | `SchemaC > State > Meta > MetaReducers` | `src/app/root-store/meta/task-shared-meta-reducers/` | Supabase RPC for atomic multi-entity changes | pattern |
| 16.3 | `SchemaC > State > Pattern > EntityAdapter` | NgRx entity adapter pattern | TanStack Query entity normalization | reference |
| 16.4 | `SchemaC > State > Pattern > LocalActions` | `src/app/util/local-actions.token.ts` | Optimistic updates with rollback (P0-002) | pattern |

---

## Key Insight Summary

**82 breadcrumb mappings** across 16 domains connect Super Productivity's codebase to SalesBlock's roadmap. The highest-value ports are:

1. **Timer state machine** (focus-mode -> useTimer hook) -- P1-001/002/003
2. **Planner data model** (planner.model + schedule.model -> useDayPlan) -- P1-004/006
3. **Available hours calculation** (schedule.service -> DayPlanner) -- P1-004
4. **Issue provider pattern** (issue.model -> CrmAdapter interface) -- P1-011/012/013
5. **Analytics computation** (metric + worklog -> Analytics page) -- P0-012, P2-010
6. **Calendar integration** (calendar-integration -> CalendarAvailabilityPanel) -- P1-010

**Everything else is pattern/reference only** -- SalesBlock's React + Supabase stack means the actual code will be entirely new.
