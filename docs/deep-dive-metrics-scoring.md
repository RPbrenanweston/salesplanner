## Comprehensive Architectural Analysis: Super Productivity → SalesBlock

Based on my thorough examination of Super Productivity's codebase, here is a detailed technical summary for porting to React/Supabase:

---

## **1. TASK SYSTEM ARCHITECTURE**

### Task Model (`task.model.ts`)
**Core Data Structure:**
```typescript
Task extends TaskCopy {
  id: string;
  title: string;
  projectId: string;  // Required - all tasks belong to a project
  
  // Time tracking
  timeSpent: number;  // Total milliseconds
  timeEstimate: number;
  timeSpentOnDay: { [dateStr]: number };  // Per-day granular tracking
  
  // Scheduling (Mutual Exclusivity Pattern)
  dueDay?: string;  // ISO date (YYYY-MM-DD) for all-day tasks
  dueWithTime?: number;  // Unix timestamp (ms) for specific-time tasks
  // CRITICAL: Check dueWithTime FIRST - it takes priority over dueDay
  remindAt?: number;  // Unix timestamp for reminders
  
  // Hierarchy
  parentId?: string;  // For subtasks
  subTaskIds: string[];  // Children IDs
  
  // Organization
  tagIds: string[];  // Multiple tags (Note: TODAY_TAG is VIRTUAL)
  isDone: boolean;
  doneOn?: number;  // Timestamp when completed
  
  // Recurring & Tracking
  repeatCfgId?: string;  // Link to repeat configuration
  attachments: TaskAttachment[];
  issueId?: string;  // External issue reference
  issueProviderId?: string;
  issueType?: IssueProviderKey;
  issueTimeTracked?: Record<string, number>;  // Time per external system
  
  created: number;  // Creation timestamp
  modified?: number;
  _hideSubTasksMode?: HideSubTasksMode;
}
```

**Virtual TODAY_TAG Pattern:** 
- TODAY_TAG (ID: `'TODAY'`) is NOT stored in `task.tagIds`
- Membership determined by `task.dueDay === today`
- Order stored in `TODAY_TAG.taskIds` (work context)
- This keeps move operations uniform across all tags

### Task Service Key Methods (`task.service.ts`)

**Add/Update Operations:**
```typescript
add(title, isAddToBacklog, additional, isAddToBottom): string
  → Creates task with automatic project/tag/dueDay defaults
  → Returns generated task ID

addAndSchedule(title, additional, due, remindCfg)
  → Adds task + sets dueWithTime + scheduleTask()

update(id, changedFields)
  → Dispatches TaskSharedActions.updateTask (uses meta-reducers)

scheduleTask(task, due, remindCfg, isMoveToBacklog)
  → Sets dueWithTime + remindAt
  → Uses remindOptionToMilliseconds(due, remindCfg)
  → Reminder options: 'DoNotRemind' | 'AtStart' | 'm5' | 'm10' | 'm15' | 'm30' | 'h1'
```

**Time Tracking (Batch Sync Pattern):**
```typescript
addTimeSpent(task, duration, date, isFromTrackingReminder)
  → Updates timeSpentOnDay[date] immediately
  → Batched in BatchedTimeSyncAccumulator (5-min flush interval)

_timeAccumulator = BatchedTimeSyncAccumulator(5min, dispatch syncTimeSpent)
  → Accumulates duration per (taskId, date)
  → Flushes every 5 minutes or when task stops/page unloads
  → Tracks PROJECT and TAG contexts separately for sync
```

**Task Movement:**
```typescript
move(taskId, src, target, newOrderedIds)
  → Routes to different handlers:
    - UNDONE/DONE ↔ UNDONE/DONE: moveTaskInTodayList
    - BACKLOG ↔ BACKLOG: moveProjectTaskInBacklogList
    - BACKLOG ↔ UNDONE/DONE: moveProjectTaskToRegularList/moveProjectTaskToBacklogList
    - Sub-tasks: moveSubTask (with circular reference validation)

moveToArchive(tasks)
  → Only moves parent tasks (prevents orphaned subtasks)
  → Removes sub-tasks from active context instead
  → Persists via _archiveService.moveTasksToArchiveAndFlushArchiveIfDue()
```

### Task Reducer State Shape (`task.reducer.ts`)

```typescript
TaskState extends EntityState<Task> {
  ids: string[];  // Task IDs in natural order
  entities: { [id: string]: Task };
  currentTaskId: string | null;  // Currently running task
  selectedTaskId: string | null;  // UI selected task
  lastCurrentTaskId: string | null;  // Previously running task
  taskDetailTargetPanel: TaskDetailTargetPanel;
  isDataLoaded: boolean;
}
```

**State Mutations:**
- `on(addTimeSpent)` → Updates `timeSpentOnDay[date] += duration`
- `on(syncTimeSpent)` → Only for REMOTE actions (local state already updated by ticks)
- `on(setCurrentTask)` → Sets currentTaskId + marks isDone=false
- `on(moveSubTask)` → Validates circular refs, updates parent/child subTaskIds
- `on(addSubTask)` → Inherits timeSpent/timeEstimate if parent's first child
- `on(roundTimeSpentForDay)` → Recalculates parent totals after rounding

---

## **2. REMINDER SYSTEM**

### Reminder Model (`reminder.model.ts`)
```typescript
Reminder {
  id: string;
  remindAt: number;  // Unix timestamp (ms)
  title: string;
  type: 'NOTE' | 'TASK';  // NOTE reminders discontinued
  relatedId: string;  // Task ID or Note ID
  recurringConfig?: Record<string, unknown>;  // TODO: Not implemented
}
```

### Reminder Service (`reminder.service.ts`)

**Architecture:**
- Uses Web Worker for background checking
- Worker receives array of reminders, emits TaskWithReminderData[] when due
- One-time migration from legacy Reminder model to task.remindAt field
- Respects global config `reminder.disableReminders`

**Flow:**
1. Store listens to `selectAllTasksWithReminder`
2. Maps tasks to WorkerReminder objects
3. Posts to Worker via `postMessage(reminders)`
4. Worker emits ready reminders via message event
5. Service maps back to TaskWithReminderData and emits `onRemindersActive$`

---

## **3. TASK REPEAT CONFIGURATION**

### TaskRepeatCfg Model (`task-repeat-cfg.model.ts`)
```typescript
TaskRepeatCfg {
  id: string;
  projectId: string | null;
  
  // Basic
  title: string | null;
  tagIds: string[];
  defaultEstimate?: number;
  
  // Repeat Pattern
  isPaused: boolean;
  quickSetting: 'DAILY' | 'WEEKLY_CURRENT_WEEKDAY' | 'MONTHLY_CURRENT_DATE' 
             | 'MONDAY_TO_FRIDAY' | 'YEARLY_CURRENT_DATE' | 'CUSTOM';
  repeatCycle: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  repeatEvery: number;  // e.g., "every 2 weeks"
  
  // Weekday selectors (for WEEKLY)
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
  
  // Date tracking
  startDate?: string;  // ISO date for monthly/yearly
  lastTaskCreationDay?: string;  // Last creation date
  
  // Advanced
  shouldInheritSubtasks?: boolean;
  subTaskTemplates?: { title: string; timeEstimate?: number; notes?: string }[];
  deletedInstanceDates?: string[];  // Exceptions (YYYY-MM-DD)
  skipOverdue?: boolean;  // Skip missed instances silently
  repeatFromCompletionDate?: boolean;  // Reset from completion, not creation
}
```

**Key Algorithms:**
- `getNextRepeatOccurrence()` - Calculate next due date based on pattern
- `getFirstRepeatOccurrence()` - Calculate initial occurrence
- `getEffectiveLastTaskCreationDay()` - Handle completion-date resets
- `getEffectiveRepeatStartDate()` - Account for first occurrence offset
- Auto-creates new instances via effects, with vector-clock aware sync

---

## **4. METRICS & ANALYTICS**

### Metric Model (`metric.model.ts`)
```typescript
Metric {
  id: string;  // ISO date string (YYYY-MM-DD)
  
  // Time tracking
  focusSessions?: number[];  // Array of session durations (ms)
  
  // Productivity scoring (v2.7 - Impact-driven)
  impactOfWork?: number | null;  // 1-4 scale (required for score)
  
  // Sustainability scoring (v2.4)
  energyCheckin?: number | null;  // 1-3 scale (1=exhausted, 2=ok, 3=good)
  
  // Legacy fields (deprecated)
  totalWorkMinutes?: number | null;
  completedTasks?: number | null;
  plannedTasks?: number | null;
  
  // Evaluation
  notes?: string | null;
  remindTomorrow?: boolean;
  reflections?: ReflectionEntry[];
}
```

### Metric Scoring Algorithms (`metric-scoring.util.ts`)

**Productivity Score (0-100):**
```
Score = 65% × Impact + 30% × Focus + 5% × Total Work
  
Impact = (impactRating / 4) × 100  // User assessment (1-4, REQUIRED)

Focus = softCap(focusedMinutes / targetMinutes) × 100
  where softCap(x) = 1 - e^(-k×clamp(x))
  k = 2.2 (decay constant)
  target = 240 min (4 hours)

TotalWork = clamp(totalWorkMinutes / 600) × 100  // Capped at 10h
```

**Sustainability Score:**
- **Freshness (45%):** Energy checkin or exhaustion level
  - `freshness = (energyCheckin - 1) / 2` for 1-3 scale
- **Workload (40%):** Sigmoid function penalizing overwork
  - `workload = 1 / (1 + e^(-0.01×(workMinutes-480)))`
  - Inflection at 8 hours, zero at ~10h
- **Focus Balance (15%):** Inverted-V peak at 4h
  - `balance = e^(-0.00001×(focusMinutes-240)²)`

**Trend Calculation:**
- Compares current 7-day average vs previous 7-day
- Returns: `{ direction: 'up'|'down'|'stable', change: number, changePercent: number }`

### Metric Service Methods
```typescript
logFocusSession(duration, day)
  → Min 1000ms to count
  → Dispatches logFocusSession action

getAverageProductivityScore$(days=7, endDate?)
  → Filters metrics, calculates average impact-driven score

getProductivityBreakdown$(days=7, endDate?)
  → Combines metrics + worklog
  → Returns { day, score, impactRating, focusedMinutes, totalWorkMinutes, energyCheckin }

getAverageSustainabilityScore$(days=7, endDate?)
getProductivityTrend$()
getSustainabilityTrend$()
  → All map over time ranges
```

---

## **5. WORKLOG SYSTEM**

### Worklog Data Structure (`worklog.model.ts`)

**Hierarchical Time Tracking:**
```typescript
Worklog = {
  [year: number]: WorklogYear {
    timeSpent: number;
    daysWorked: number;
    ent: { [month: number]: WorklogMonth }
    
    WorklogMonth {
      timeSpent: number;
      daysWorked: number;
      ent: { [dayOfMonth: number]: WorklogDay }
      weeks: WorklogWeek[]
      
      WorklogDay {
        timeSpent: number;
        logEntries: WorklogDataForDay[]  // Task breakdowns
        dateStr: string;  // ISO date
        dayStr: string;  // Day name
        workStart: number;  // Timestamp
        workEnd: number;
        
        WorklogDataForDay {
          timeSpent: number;
          task: Task;
          parentId?: string;
          isNoRestore: boolean;
        }
      }
      
      WorklogWeek extends WeeksInMonth {
        weekNr: number;
        timeSpent: number;
        daysWorked: number;
        ent: { [dayOfWeek: number]: WorklogDay }
      }
    }
  }
}
```

### Worklog Service (`worklog.service.ts`)

**Key Methods:**
```typescript
// Triggers via router navigation or manual trigger
worklogData$: Observable<{ worklog: Worklog; totalTimeSpent: number }>
  → Built from archive on demand
  → Cached via shareReplay()

getWorklogTask$(projectId, day, taskId)
  → Get time spent for specific task on specific day

getRoundingValue(day, taskIds, roundTo, isRoundUp, projectId)
  → Round times with options: '15MIN' | '30MIN' | '1H' | '5MIN'

// Aggregations
currentWeek$: Observable<WorklogWeek>
  → Today's week metrics
  
quickHistoryWeeks$: Observable<WorklogWeekSimple[]>
  → Last 52 weeks (for heatmaps)
```

**Building Worklog:**
1. Gets active work context (Project or Tag)
2. Loads all tasks for context from active + archive
3. Maps task.timeSpentOnDay → year/month/day/task breakdown
4. Aggregates time per day, week, month, year
5. Caches result with manual trigger for UI changes

---

## **6. SIMPLE COUNTER SYSTEM**

### SimpleCounter Model (`simple-counter.model.ts`)
```typescript
SimpleCounter {
  id: string;
  title: string;
  isEnabled: boolean;
  isHideButton?: boolean;
  icon: string | null;
  
  // Type determines behavior
  type: 'StopWatch' | 'ClickCounter' | 'RepeatedCountdownReminder';
  
  // Streaks (optional)
  isTrackStreaks?: boolean;
  streakMinValue?: number;  // Min count to maintain streak
  streakMode?: 'specific-days' | 'weekly-frequency';
  streakWeekDays?: { [dayOfWeek: number]: boolean };  // Mon-Sun
  streakWeeklyFrequency?: number;  // e.g., min 3 days/week
  
  // Countdown specific
  countdownDuration?: number;  // Milliseconds
  
  // Dynamic state
  countOnDay: { [dateStr]: number };  // Daily values
  isOn: boolean;  // Running state
}
```

### SimpleCounter Service (`simple-counter.service.ts`)

**Operations:**
```typescript
// Increment/Decrement (Click Counters)
increaseCounterToday(id, increaseBy)
  → Read current value → Update locally → Sync absolute value

decreaseCounterToday(id, decreaseBy)
  → Prevents negative (Math.max(0, current - decreaseBy))

setCounterForDate(id, date, newVal)
  → Set absolute value for specific date

// Stopwatch tracking (batched sync, 5-min intervals)
tickSimpleCounterLocal(id, increaseBy, today)
  → Immediate UI update (non-persistent)

_stopwatchAccumulator
  → Batches duration per (counterId, date)
  → Flushes every 5 minutes or on toggle/visibility change
  → Syncs via setSimpleCounterCounterToday() with absolute value

// UI state
toggleCounter(id)
  → Toggle running state

turnOffAll()
  → Stop all running counters
```

**Streak Tracking:**
- `getSimpleCounterStreakDuration()` - Calculate current streak length
- Checks either specific weekdays or weekly frequency target
- Used for habit/goal visualization

---

## **7. GLOBAL CONFIGURATION SYSTEM**

### Config Structure (`global-config.model.ts`)

**Master Config State:**
```typescript
GlobalConfigState {
  // Feature flags
  appFeatures: {
    isTimeTrackingEnabled: boolean;
    isFocusModeEnabled: boolean;
    isSchedulerEnabled: boolean;
    isPlannerEnabled: boolean;
    isBoardsEnabled: boolean;
    // ... etc
  };
  
  // Tasks
  tasks: {
    isAutoMarkParentAsDone: boolean;
    isAutoAddWorkedOnToToday: boolean;
    isTrayShowCurrent: boolean;
    isMarkdownFormattingInNotesEnabled: boolean;
    defaultProjectId?: string | null;
    notesTemplate: string;
  };
  
  // Time tracking
  timeTracking: {
    defaultEstimate?: number | null;
    defaultEstimateSubTasks?: number | null;
    isAutoStartNextTask: boolean;
    isNotifyWhenTimeEstimateExceeded: boolean;
    isTrackingReminderEnabled: boolean;
    trackingReminderMinTime: number;
  };
  
  // Reminders
  reminder: {
    isCountdownBannerEnabled: boolean;
    countdownDuration: number;
    defaultTaskRemindOption?: TaskReminderOptionId;
    disableReminders?: boolean;
    notifyOnDueDate?: boolean;
    dueDateNotificationHour?: number;
  };
  
  // Idle & break detection
  idle: {
    isEnableIdleTimeTracking: boolean;
    minIdleTime: number;
    isOnlyOpenIdleWhenCurrentTask: boolean;
  };
  
  takeABreak: {
    isTakeABreakEnabled: boolean;
    takeABreakMinWorkingTime: number;
    takeABreakSnoozeTime: number;
    motivationalImgs: (string | undefined | null)[];
  };
  
  // Scheduling
  schedule: {
    isWorkStartEndEnabled: boolean;
    workStart: string;  // HH:MM
    workEnd: string;
    isLunchBreakEnabled: boolean;
    lunchBreakStart: string;
    lunchBreakEnd: string;
  };
  
  // Sync
  sync: {
    isEnabled: boolean;
    syncProvider: SyncProviderId | null;  // 'DROPBOX' | 'WEBDAV' | 'SUPERTYNC' | 'LOCAL'
    syncInterval: number;
    isEncryptionEnabled?: boolean;
    isCompressionEnabled?: boolean;
    webDav?: WebDavConfig;
    superSync?: SuperSyncConfig;
  };
  
  // Localization
  localization: {
    lng?: LanguageCode | null;  // 'en' | 'de' | 'fr' | etc
    firstDayOfWeek?: number | null;
    dateTimeLocale?: DateTimeLocale | null;
  };
  
  // UI Preferences
  misc: {
    isConfirmBeforeExit: boolean;
    isDisableAnimations: boolean;
    customTheme?: string;
    defaultStartPage?: number;
    unsplashApiKey?: string | null;
  };
}
```

**Form Generation:**
- Uses `ConfigFormSection[]` for dynamic form rendering
- Each section has `title`, `key`, `items[]` (FormlyFieldConfig[])
- FormlyFieldConfig maps to Angular Material inputs
- Supports custom sections for provider-specific configs (JIRA_CFG, OPENPROJECT_CFG, etc.)

---

## **8. ISSUE PROVIDER PATTERN (CRM Adapter Model)**

### Issue Model (`issue.model.ts`)

**Provider Registry:**
```typescript
// Type-safe provider keys
IssueProviderKey = 'JIRA' | 'GITLAB' | 'GITHUB' | 'CALDAV' | 'ICAL' 
                 | 'OPEN_PROJECT' | 'GITEA' | 'REDMINE' | 'TRELLO' 
                 | 'LINEAR' | 'CLICKUP' | 'AZURE_DEVOPS' | 'NEXTCLOUD_DECK'
                 | `plugin:${string}`;

// Provider instance
IssueProvider {
  id: string;  // Unique provider ID
  isEnabled: boolean;
  issueProviderKey: IssueProviderKey;
  defaultProjectId?: string | null;
  pinnedSearch?: string | null;
  isAutoPoll?: boolean;
  isAutoAddToBacklog?: boolean;
  isIntegratedAddTaskBar?: boolean;
  
  // Type-specific config (discriminated union)
  // Built-in: JiraCfg, GitlabCfg, etc. mixed in
  // Plugin: { pluginId: string; pluginConfig: Record<string, unknown> }
}

// State
IssueProviderState extends EntityState<IssueProvider> {
  ids: string[];
  entities: { [id: string]: IssueProvider };
}
```

### Issue Service (`issue.service.ts`)

**Provider Registry Pattern:**
```typescript
ISSUE_SERVICE_MAP: { [key: string]: IssueServiceInterface } = {
  'JIRA': JiraCommonInterfacesService,
  'GITLAB': GitlabCommonInterfacesService,
  'CALDAV': CaldavCommonInterfacesService,
  'OPEN_PROJECT': OpenProjectCommonInterfacesService,
  'GITEA': GiteaCommonInterfacesService,
  'LINEAR': LinearCommonInterfacesService,
  'CLICKUP': ClickUpCommonInterfacesService,
  // ... etc
};

// Runtime routing
private _getService(issueProviderKey: IssueProviderKey): IssueServiceInterface | null {
  if (isPluginIssueProvider(issueProviderKey)) {
    return this._pluginAdapter.getAdapterFor(issueProviderKey);
  }
  return this.ISSUE_SERVICE_MAP[issueProviderKey] || null;
}
```

### IssueServiceInterface (Required Impl)

```typescript
interface IssueServiceInterface {
  testConnection(cfg: IssueIntegrationCfg): Promise<boolean>;
  
  getById(id: string | number, issueProviderId: string): Promise<IssueData | null>;
  
  searchIssues(searchTerm: string, issueProviderId: string): Promise<SearchResultItem[]>;
  
  getMultiple(ids: (string | number)[], issueProviderId: string): Promise<(IssueData | null)[]>;
  
  createIssue(issueCfg: IssueTask, issueProviderId: string): Promise<IssueData>;
  
  updateIssue(id: string | number, issueData: Partial<IssueData>, issueProviderId: string): Promise<IssueData>;
  
  getOpenCloseStatusForProject(
    projectId: string,
    issueProviderId: string
  ): Promise<{ openStatus: string[]; closedStatus: string[] }>;
  
  getStateForTask(task: Task, issueProviderId: string): Promise<IssueLocalState>;
}
```

**Methods:**
```typescript
testConnection(issueProviderCfg: IssueProvider): Promise<boolean>
  → Verify credentials work

getById(issueType, id, issueProviderId): Promise<IssueData | null>
  → Fetch single issue/task from external system

searchIssues(searchTerm, issueProviderId, issueProviderKey): Promise<SearchResultItem[]>
  → Full-text search, returns title + metadata

searchAllEnabledIssueProviders$(searchTerm): Observable<SearchResultItemWithProviderId[]>
  → Parallel search across all active providers

getAttachments(task, issueProviderId): Promise<TaskAttachment[]>
  → Fetch issue attachments as task attachments

createFromIssue(issue, issueProviderId, issueProviderKey): string
  → Create task from external issue, returns task ID

pullTaskData$(issueProviderKey, id, issueProviderId): Observable<IssueData | null>
  → Live updates via subject refresh map
```

**Refresh Mechanism (Real-time Updates):**
```typescript
ISSUE_REFRESH_MAP: {
  [issueProviderId: string]: {
    [issueId: string]: Subject<IssueData>
  }
}

getById$(issueType, id, issueProviderId): Observable<IssueData | null>
  → Returns merge(initial fetch, refresh subject)
  → Allows components to trigger refreshes
```

---

## **9. WORK CONTEXT MODEL** (`work-context.model.ts`)

```typescript
WorkContextType = 'PROJECT' | 'TAG';

WorkContext {
  id: string;  // Project/Tag ID
  type: WorkContextType;
  title: string;
  icon?: string | null;
  
  // Task organization
  taskIds: string[];  // Ordered today/main list
  backlogTaskIds?: string[];  // Project-only
  noteIds: string[];
  
  // Advanced config
  advancedCfg: {
    worklogExportSettings: WorklogExportSettings {
      roundWorkTimeTo: '15MIN' | '30MIN' | '1H' | '5MIN';
      roundStartTimeTo: RoundTimeOption;
      roundEndTimeTo: RoundTimeOption;
      cols: WorklogColTypes[];  // DATE | START | END | TITLES | TIME_MS | etc
      groupBy: 'DATE' | 'PARENT' | 'TASK' | 'WORKLOG';
    };
  };
  
  // Theming
  theme: {
    primary?: string;  // Color hex
    accent?: string;
    warn?: string;
    backgroundImageDark?: string | null;
    backgroundImageLight?: string | null;
    backgroundOverlayOpacity?: number;
    isAutoContrast?: boolean;
  };
  
  advancedCfg: WorkContextAdvancedCfg;
  routerLink: string;  // URL path
}
```

---

## **10. SUPABASE TABLE DESIGN RECOMMENDATIONS**

### Core Tables

```sql
-- Sales Blocks (Tasks)
sales_blocks {
  id: uuid PRIMARY KEY;
  title: string;
  description: string;
  project_id: uuid REFERENCES projects(id);
  
  -- Time tracking
  time_spent_ms: bigint;  -- Total milliseconds
  time_estimate_ms: bigint;
  time_spent_on_day: jsonb;  -- { "2024-03-20": 3600000, ... }
  
  -- Scheduling
  due_day: date;  -- For all-day tasks
  due_with_time: timestamp;  -- For specific times
  remind_at: timestamp;
  
  -- Hierarchy
  parent_id: uuid REFERENCES sales_blocks(id);
  is_done: boolean;
  done_on: timestamp;
  
  -- Organization
  tag_ids: uuid[];  -- Array of tag IDs
  repeat_cfg_id: uuid;
  
  -- CRM Integration
  issue_id: string;
  issue_provider_id: string;
  issue_type: string;  -- 'JIRA' | 'SALESFORCE' | etc
  issue_time_tracked: jsonb;  -- { provider: minutes }
  
  created_at: timestamp;
  updated_at: timestamp;
  user_id: uuid;
}

-- Sessions (Worklog entries)
sessions {
  id: uuid PRIMARY KEY;
  sales_block_id: uuid REFERENCES sales_blocks(id);
  start_time: timestamp;
  end_time: timestamp;
  duration_ms: bigint;
  date_str: string;  -- ISO date for grouping
  
  context_type: 'PROJECT' | 'TAG';  -- Track context of work
  context_id: uuid;  -- Project or tag ID
  
  created_at: timestamp;
  user_id: uuid;
}

-- Metrics (Daily summaries)
metrics {
  id: uuid PRIMARY KEY;
  date: date;
  
  -- Focus sessions
  focus_sessions: integer[];  -- Array of durations in ms
  
  -- Productivity
  impact_of_work: integer;  -- 1-4 scale
  
  -- Sustainability
  energy_checkin: integer;  -- 1-3 scale
  
  -- Reflection
  notes: text;
  reflections: jsonb;  -- [{ text, created }]
  
  created_at: timestamp;
  updated_at: timestamp;
  user_id: uuid;
}

-- Simple Counters
counters {
  id: uuid PRIMARY KEY;
  title: string;
  icon: string;
  type: 'StopWatch' | 'ClickCounter' | 'RepeatedCountdownReminder';
  
  is_enabled: boolean;
  is_tracking_streaks: boolean;
  streak_min_value: integer;
  streak_mode: 'specific-days' | 'weekly-frequency';
  streak_weekdays: jsonb;  -- { 0-6: boolean }
  
  count_on_day: jsonb;  -- { "2024-03-20": 5, ... }
  is_on: boolean;
  
  countdown_duration_ms: bigint;
  
  created_at: timestamp;
  updated_at: timestamp;
  user_id: uuid;
}

-- Repeat Configuration
repeat_configs {
  id: uuid PRIMARY KEY;
  project_id: uuid;
  
  title: string;
  tag_ids: uuid[];
  default_estimate_ms: bigint;
  
  is_paused: boolean;
  quick_setting: 'DAILY' | 'WEEKLY_CURRENT_WEEKDAY' | ...;
  repeat_cycle: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  repeat_every: integer;
  
  start_date: date;
  last_task_creation_day: date;
  
  weekday_flags: jsonb;  -- { monday: true, ... }
  
  should_inherit_subtasks: boolean;
  subtask_templates: jsonb;  -- [{ title, estimate, notes }]
  deleted_instance_dates: date[];
  skip_overdue: boolean;
  
  created_at: timestamp;
  updated_at: timestamp;
  user_id: uuid;
}

-- Settings
settings {
  id: uuid PRIMARY KEY;
  user_id: uuid;
  
  config_state: jsonb;  -- Entire GlobalConfigState
  -- Includes: appFeatures, tasks, timeTracking, reminder, schedule, sync, etc.
  
  created_at: timestamp;
  updated_at: timestamp;
}

-- CRM Connections
crm_connections {
  id: uuid PRIMARY KEY;
  user_id: uuid;
  
  provider_key: string;  -- 'JIRA' | 'SALESFORCE' | 'HUBSPOT' | etc
  provider_id: string;  -- Unique ID for this connection
  
  is_enabled: boolean;
  config: jsonb;  -- Provider-specific config (token, URL, etc)
  
  is_auto_poll: boolean;
  is_auto_add_to_backlog: boolean;
  
  created_at: timestamp;
  updated_at: timestamp;
}

-- Reminders (if custom implementation needed)
reminders {
  id: uuid PRIMARY KEY;
  sales_block_id: uuid REFERENCES sales_blocks(id);
  
  remind_at: timestamp;
  title: string;
  
  created_at: timestamp;
  user_id: uuid;
}
```

---

## **11. REACT HOOKS ARCHITECTURE RECOMMENDATIONS**

### Core Hooks

```typescript
// useMetrics.ts
const useMetrics = (dateRange?: { start: string; end: string }) => {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [productivityScore, setProductivityScore] = useState<number | null>(null);
  const [sustainabilityScore, setSustainabilityScore] = useState<number | null>(null);
  const [trend, setTrend] = useState<TrendIndicator | null>(null);
  
  useEffect(() => {
    // Fetch metrics for date range
    // Calculate scores using metric-scoring.util algorithms
  }, [dateRange]);
  
  return {
    metrics,
    productivityScore,
    sustainabilityScore,
    trend,
    logFocusSession: (duration, day) => {},
    upsertMetric: (metric) => {},
  };
};

// useWorklog.ts
const useWorklog = (contextType: 'PROJECT' | 'TAG', contextId: string) => {
  const [worklog, setWorklog] = useState<Worklog>({});
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [currentWeek, setCurrentWeek] = useState<WorklogWeek | null>(null);
  
  useEffect(() => {
    // Load worklog structure from sessions
    // Aggregate by year/month/day
  }, [contextType, contextId]);
  
  return {
    worklog,
    totalTimeSpent,
    currentWeek,
    roundTimeSpent: (day, taskIds, roundTo, isRoundUp) => {},
  };
};

// useReminders.ts
const useReminders = () => {
  const [dueReminders, setDueReminders] = useState<TaskWithReminderData[]>([]);
  
  useEffect(() => {
    const checkReminders = setInterval(() => {
      // Poll reminders, emit when remindAt <= now
    }, 1000);
    return () => clearInterval(checkReminders);
  }, []);
  
  return {
    dueReminders,
    acknowledgeReminder: (reminderId) => {},
  };
};

// useSimpleCounters.ts
const useSimpleCounters = () => {
  const [counters, setCounters] = useState<SimpleCounter[]>([]);
  
  const increaseCounter = async (counterId, amount = 1) => {
    // Calculate absolute value, dispatch sync
  };
  
  const decreaseCounter = async (counterId, amount = 1) => {
    // Prevent negative
  };
  
  const toggleCounter = (counterId) => {
    // Toggle isOn state
  };
  
  return { counters, increaseCounter, decreaseCounter, toggleCounter };
};

// useCrmAdapter.ts
const useCrmAdapter = (providerKey: IssueProviderKey, providerId: string) => {
  const [provider, setProvider] = useState<IssueProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const testConnection = async (config) => {
    // Route to provider-specific service
  };
  
  const searchIssues = async (query: string) => {
    // Search external system
  };
  
  const createTaskFromIssue = async (issueData) => {
    // Create local sales_block from external issue
  };
  
  const syncTimeToIssue = async (taskId, issuId, durationMs) => {
    // Push time tracking back to CRM
  };
  
  return {
    provider,
    isConnected,
    testConnection,
    searchIssues,
    createTaskFromIssue,
    syncTimeToIssue,
  };
};

// useCrmRegistry.ts - Provider pattern
const useCrmRegistry = () => {
  const adapters = useRef<Map<IssueProviderKey, CrmAdapterService>>(new Map());
  
  const registerAdapter = (providerKey: IssueProviderKey, adapter: CrmAdapterService) => {
    adapters.current.set(providerKey, adapter);
  };
  
  const getAdapter = (providerKey: IssueProviderKey): CrmAdapterService | null => {
    return adapters.current.get(providerKey) || null;
  };
  
  return { registerAdapter, getAdapter };
};
```

### CRM Adapter Interface

```typescript
interface CrmAdapterService {
  provider: IssueProviderKey;
  
  testConnection(config: CrmConnectionConfig): Promise<boolean>;
  
  searchIssues(query: string, config: CrmConnectionConfig): Promise<SearchResultItem[]>;
  
  getIssue(issueId: string, config: CrmConnectionConfig): Promise<IssueData | null>;
  
  createIssue(data: IssueTask, config: CrmConnectionConfig): Promise<IssueData>;
  
  updateIssue(
    issueId: string,
    changes: Partial<IssueData>,
    config: CrmConnectionConfig
  ): Promise<IssueData>;
  
  getStateForTask(task: Task, config: CrmConnectionConfig): Promise<IssueLocalState>;
  
  // Time tracking sync
  logTimeSpent(
    issueId: string,
    durationMs: number,
    config: CrmConnectionConfig
  ): Promise<void>;
}

// Implementation registrations
const jiraAdapter: CrmAdapterService = {
  provider: 'JIRA',
  testConnection: async (config) => { /* ... */ },
  // ... etc
};

const salesforceAdapter: CrmAdapterService = {
  provider: 'SALESFORCE',
  testConnection: async (config) => { /* ... */ },
  // ... etc
};
```

---

## **12. CRITICAL PATTERNS FOR PORTING**

### 1. **Batched Time Sync Pattern**
- Accumulate duration changes in memory for 5 minutes
- Flush to persistent storage on interval, toggle, or page visibility
- Prevents excessive database writes
- Essential for smooth UI responsiveness

### 2. **Virtual TODAY_TAG Pattern**
- TODAY_TAG is NEVER in task.tagIds
- Membership computed from `task.dueDay === today`
- Ordering stored separately in context.taskIds
- Simplifies move operations - same code for all tags

### 3. **Mutual Exclusivity: dueDay vs dueWithTime**
- Only one should be set
- dueWithTime takes priority
- Check dueWithTime FIRST when reading
- Legacy data may have both - handle gracefully

### 4. **Provider Registry Pattern**
- Dynamic routing to provider services
- Type-safe discriminated unions for configs
- Plugin support via "plugin:" prefix
- Extensible without code changes

### 5. **Meta-Reducers for Multi-Entity Changes**
- Use for operations affecting 2+ entities (e.g., deleting a tag removes from all tasks)
- Ensures single operation in log, prevents partial sync
- Example: TaskSharedActions trigger meta-reducers that update task + context

### 6. **Circular Reference Validation**
- Check when moving tasks to new parents
- Prevent task from becoming descendant of its own child
- Use visited set to detect cycles

### 7. **Streak Calculation**
- Track either specific weekdays OR weekly frequency target
- Minimum value threshold configurable per counter
- Store weekday booleans in config

---

## **Summary for SalesBlock Architecture**

**Key Takeaways for React/Supabase:**

1. **Task Structure** → Denormalize timeSpentOnDay into jsonb for easy aggregation
2. **Sessions** → Create explicit session records for worklog reconstruction
3. **Metrics** → Pre-compute productivity scores using impact-driven algorithm
4. **Counters** → Batch stopwatch updates with 5-min sync intervals
5. **CRM Adapters** → Implement pluggable interface pattern for Salesforce, HubSpot, etc.
6. **Config** → Store entire GlobalConfigState as jsonb per user
7. **Reminders** → Use Web Worker or server-side job for background checking
8. **Worklog** → Build hierarchical year/month/day/task structure on-demand from sessions
9. **Repeat Config** → Support all repeat patterns + overdue skipping
10. **Time Tracking** → Track per-context (project/tag) for proper worklog attribution

This architecture prioritizes **accurate time tracking**, **flexible CRM integration**, and **efficient sync** across the core productivity loop.
