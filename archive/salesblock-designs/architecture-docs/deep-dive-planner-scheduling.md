## COMPREHENSIVE ARCHITECTURAL ANALYSIS: Super Productivity Planner & Scheduling System

---

### EXECUTIVE SUMMARY

Super Productivity's Planner & Scheduling system is a sophisticated day-planning and time-blocking application built on Angular + NgRx. It combines drag-drop task assignment with real-time schedule visualization, available hours calculation, and multi-modal planning flows. Key innovation: **planned tasks separate from "today" context** with timestamp-precision scheduling via `dueWithTime` vs. all-day `dueDay`.

---

## 1. DATA MODELS & TYPE SYSTEM

### 1.1 Core Planner Models (`planner.model.ts`)

```typescript
export enum ScheduleItemType {
  Task = 'Task',
  CalEvent = 'CalEvent',
  RepeatProjection = 'RepeatProjection',
}

export interface PlannerDay {
  isToday?: boolean;
  dayDate: string;                           // YYYY-MM-DD
  timeEstimate: number;                      // ms, sum of task time estimates
  timeLimit: number;                         // Deprecated, set to 0
  itemsTotal: number;                        // Count of all items
  tasks: TaskCopy[];                         // Unscheduled day-plan tasks
  noStartTimeRepeatProjections: NoStartTimeRepeatProjection[];  // Repeats without specific time
  allDayEvents: ScheduleFromCalendarEvent[];
  scheduledIItems: ScheduleItem[];           // Timed items (tasks + repeats + events)
  availableHours?: number;                   // Computed: work hours - lunch break (ms)
  progressPercentage?: number;               // timeEstimate / availableHours * 100
}

export interface PlannerDayMap {
  [dayDate: string]: TaskCopy[];  // State shape: { "2024-03-20": [taskId1, taskId2] }
}

export interface ScheduleItemBase {
  id: string;
  type: ScheduleItemType;
  start: number;  // Unix timestamp (ms)
  end: number;    // Unix timestamp (ms)
}

export interface ScheduleItemTask extends ScheduleItemBase {
  type: ScheduleItemType.Task;
  task: TaskCopy;
}

export interface ScheduleItemRepeatProjection extends ScheduleItemBase {
  type: ScheduleItemType.RepeatProjection;
  repeatCfg: TaskRepeatCfg;
}

export interface ScheduleItemEvent extends ScheduleItemBase {
  type: ScheduleItemType.CalEvent;
  calendarEvent: ScheduleItemCalendarEventData;
}

export interface ScheduleItemCalendarEventData {
  title: string;
  duration: number;  // ms
  provider?: any;
  ico?: string;
}
```

**Key Constants:**
- `ADD_TASK_PANEL_ID = 'ADD_TASK_PANEL'` — Special panel for adding new tasks
- `OVERDUE_LIST_ID = 'OVERDUE_LIST'` — Special list for overdue tasks

### 1.2 Task Model Fields for Scheduling (`task.model.ts`)

```typescript
export interface TaskCopy {
  // Scheduling Fields (CRITICAL MUTUAL EXCLUSIVITY):
  dueWithTime?: number | null;      // Unix timestamp (ms) with specific time
  dueDay?: string | null;           // ISO date "YYYY-MM-DD" for all-day tasks
  // IMPORTANT: dueWithTime takes PRIORITY over dueDay when both present
  // Legacy data may have both; always check dueWithTime FIRST
  
  hasPlannedTime?: boolean;         // Flag indicating if task has specific time
  plannedAt?: number;               // Not explicitly in code, but inferred concept
  
  // Time Tracking:
  timeEstimate: number;             // Estimated duration in ms
  timeSpent: number;                // Actual time tracked in ms
  timeSpentOnDay: TimeSpentOnDay;   // { [dayDateStr]: ms }
  
  // Task Status:
  isDone: boolean;
  doneOn?: number;                  // Unix timestamp when completed
  
  // Relationships:
  parentId?: string;
  subTaskIds: string[];
  tagIds: string[];
  projectId: string;
}

export type TimeSpentOnDay = Readonly<{ [key: string]: number }>;
```

### 1.3 Schedule Model - Timeline View Entries (`schedule.model.ts`)

```typescript
export enum SVEType {
  // Basic task types
  Task = 'Task',                               // Unscheduled task
  TaskPlannedForDay = 'TaskPlannedForDay',     // Planned task (all-day)
  ScheduledTask = 'ScheduledTask',             // Scheduled with dueWithTime
  
  // Split tasks (span multiple days)
  SplitTask = 'SplitTask',
  SplitTaskPlannedForDay = 'SplitTaskPlannedForDay',
  SplitTaskContinued = 'SplitTaskContinued',
  SplitTaskContinuedLast = 'SplitTaskContinuedLast',
  
  // Repeat projections (recurring tasks)
  RepeatProjection = 'RepeatProjection',
  ScheduledRepeatProjection = 'ScheduledRepeatProjection',
  RepeatProjectionSplit = 'RepeatProjectionSplit',
  RepeatProjectionSplitContinued = 'RepeatProjectionSplitContinued',
  RepeatProjectionSplitContinuedLast = 'RepeatProjectionSplitContinuedLast',
  
  // Calendar & work boundaries
  CalendarEvent = 'CalendarEvent',
  WorkdayStart = 'WorkdayStart',
  WorkdayEnd = 'WorkdayEnd',
  LunchBreak = 'LunchBreak',
}

export interface ScheduleDay {
  dayDate: string;
  entries: SVE[];                    // All schedule entries (rendered in UI)
  beyondBudgetTasks: TaskCopy[];     // Tasks that overflow beyond available hours
  isToday: boolean;
}

// Schedule View Entry (SVE) - Discriminated union of all entry types
export type SVE =
  | SVETask
  | SVESplitTaskStart
  | SVETaskPlannedForDay
  | SVEScheduledRepeatProjection
  | SVERepeatProjection
  | SVERepeatProjectionSplit
  | SVERepeatProjectionSplitContinued
  | SVESplitTaskContinued
  | SVECalendarEvent
  | SVEWorkStart
  | SVEWorkEnd
  | SVELunchBreak;

// Blocked blocks: discrete time ranges that prevent task scheduling
export enum BlockedBlockType {
  ScheduledTask = 'ScheduledTask',
  ScheduledRepeatProjection = 'ScheduledRepeatProjection',
  CalendarEvent = 'CalendarEvent',
  WorkdayStartEnd = 'WorkdayStartEnd',
  LunchBreak = 'LunchBreak',
}

export interface BlockedBlock {
  start: number;
  end: number;
  isBlockedWholeDay?: true;
  entries: BlockedBlockEntry[];     // Array of conflicting items
}

export type BlockedBlockByDayMap = {
  [dayDate: string]: BlockedBlock[];
};
```

### 1.4 Schedule Configuration (`global-config.model.ts` lines 180-187)

```typescript
export type ScheduleConfig = Readonly<{
  isWorkStartEndEnabled: boolean;
  workStart: string;                 // "HH:mm" e.g. "09:00"
  workEnd: string;                   // "HH:mm" e.g. "17:30"
  isLunchBreakEnabled: boolean;
  lunchBreakStart: string;           // "HH:mm" e.g. "12:00"
  lunchBreakEnd: string;             // "HH:mm" e.g. "13:00"
}>;
```

---

## 2. AVAILABLE HOURS CALCULATION ALGORITHM

**Location:** `src/app/features/planner/util/calculate-available-hours.ts`

This is the **critical algorithm** for determining remaining daily capacity:

```typescript
export const DEFAULT_WORK_HOURS = 8 * 60 * 60 * 1000;  // 8 hours in ms

export const calculateAvailableHours = (
  dayDate: string,
  scheduleConfig: ScheduleConfig,
): number => {
  // If work hours not configured, default to 8 hours
  if (!scheduleConfig.isWorkStartEndEnabled) {
    return DEFAULT_WORK_HOURS;
  }

  const date = dateStrToUtcDate(dayDate);  // Convert "YYYY-MM-DD" to Date

  try {
    // Parse work hours
    const workStart = getDateTimeFromClockString(
      scheduleConfig.workStart,  // "09:00"
      date
    );
    const workEnd = getDateTimeFromClockString(
      scheduleConfig.workEnd,    // "17:30"
      date
    );

    // Available time = work end - work start
    let availableTime = workEnd - workStart;

    // Subtract lunch break if enabled AND it falls within work hours
    if (scheduleConfig.isLunchBreakEnabled) {
      const lunchStart = getDateTimeFromClockString(
        scheduleConfig.lunchBreakStart,  // "12:00"
        date
      );
      const lunchEnd = getDateTimeFromClockString(
        scheduleConfig.lunchBreakEnd,    // "13:00"
        date
      );

      // Only subtract if lunch break is fully within work hours
      if (lunchStart >= workStart && lunchEnd <= workEnd) {
        availableTime -= (lunchEnd - lunchStart);
      }
    }

    return Math.max(0, availableTime);
  } catch (error) {
    Log.err('Error calculating available hours:', error);
    return DEFAULT_WORK_HOURS;
  }
};
```

**Usage in Selectors:**
```typescript
// From planner.selectors.ts
if (scheduleConfig && scheduleConfig.isWorkStartEndEnabled) {
  availableHours = calculateAvailableHours(dayDate, scheduleConfig);
  // Calculate how full the day is
  progressPercentage = availableHours > 0 
    ? (timeEstimate / availableHours) * 100 
    : 0;
}
```

**Key Insights:**
- Returns **milliseconds**, not hours
- Lunch break only counts if **entirely within** work hours
- Fallback to 8 hours if config disabled or parsing fails
- `progressPercentage` shows visual capacity (0-100%+, can exceed 100%)

---

## 3. STATE MANAGEMENT (NgRx)

### 3.1 Planner Reducer State Shape (`planner.reducer.ts`)

```typescript
export interface PlannerState {
  days: {
    [dayDate: string]: string[];  // Map of day -> array of task IDs
  };
  addPlannedTasksDialogLastShown: string | undefined;
}

export const plannerInitialState: PlannerState = {
  days: {},
  addPlannedTasksDialogLastShown: undefined,
};
```

**State Updates Flow:**
```
Task UI → Action → Reducer → PlannerState.days[dayDate] = [taskIds]
                                                          ↓
                            Selector → PlannerDay[] (with computed fields)
                                      ↓
                            Component Display (drag-drop list)
```

### 3.2 Planner Actions (`planner.actions.ts`)

```typescript
export const PlannerActions = createActionGroup({
  source: 'Planner',
  events: {
    // Create/update day planning
    'Upsert Planner Day': (props: {
      day: string;           // "YYYY-MM-DD"
      taskIds: string[];     // Ordered task IDs for the day
    }) => ({ ...props, meta: { isPersistent: true, ... } }),

    // Cleanup old/deleted tasks
    'Cleanup Old And Undefined Planner Tasks': (props: {
      today: string;
      allTaskIds: string[];
    }) => ({ ...props }),

    // Move task between days or within day
    'Transfer Task': (props: {
      task: TaskCopy;
      prevDay: string | 'ADD_TASK_PANEL';
      newDay: string | 'ADD_TASK_PANEL';
      targetIndex: number;
      targetTaskId?: string;
      today: string;
    }) => ({ ...props, meta: { isPersistent: true, opType: OpType.Move } }),

    // Reorder within a day
    'Move In List': (props: {
      targetDay: string;
      fromIndex: number;
      toIndex: number;
    }) => ({ ...props, meta: { isPersistent: true, opType: OpType.Move } }),

    // Move before specific task
    'Move Before Task': (props: {
      fromTask: TaskCopy;
      toTaskId: string;
    }) => ({ ...props, meta: { isPersistent: true, opType: OpType.Move } }),

    // Plan task for specific day
    'Plan Task for Day': (props: {
      task: TaskCopy;
      day: string;
      isAddToTop?: boolean;
      isShowSnack?: boolean;
    }) => ({ ...props, meta: { isPersistent: true, opType: OpType.Update } }),

    // UI state
    'Update Planner Dialog Last Shown': (props: { today: string }) => ({
      ...props,
    }),
  },
});
```

### 3.3 Planner Selectors (`planner.selectors.ts`)

**Key Selector: `selectPlannerDays`**
```typescript
export const selectPlannerDays = (
  dayDates: string[],
  taskRepeatCfgs: TaskRepeatCfg[],
  todayListTaskIds: string[],
  icalEvents: ScheduleCalendarMapEntry[],
  allPlannedTasks: TaskWithDueTime[],
  todayStr: string,
) => createSelector(
  selectTaskFeatureState,
  selectPlannerState,
  selectConfigFeatureState,
  selectStartOfNextDayDiffMs,
  (taskState, plannerState, globalConfig, startOfNextDayDiffMs): PlannerDay[] => {
    // For each dayDate, build PlannerDay with:
    // - tasks from planner state
    // - repeat projections due that day
    // - scheduled tasks with times
    // - calendar events
    // - calculated availableHours & progressPercentage
    
    return dayDates.map(dayDate =>
      getPlannerDay(
        dayDate,
        todayStr,
        taskState,
        plannerState,
        taskRepeatCfgs,
        allPlannedTasks,
        icalEvents,
        unplannedTaskIdsToday,
        globalConfig.schedule,
        startOfNextDayDiffMs,
      )
    );
  },
);
```

### 3.4 Planner Effects (`planner.effects.ts`)

```typescript
@Injectable()
export class PlannerEffects {
  planForDaySnack$ = createEffect(
    () => {
      return this._actions$.pipe(
        ofType(PlannerActions.planTaskForDay),
        filter((action) => !!action.isShowSnack),
        tap(async (action) => {
          // Show snack: "Task planned for <date>"
          // Include summary: count + time estimate
        }),
      );
    },
    { dispatch: false },
  );
}
```

---

## 4. SERVICE LAYER ARCHITECTURE

### 4.1 PlannerService (`planner.service.ts`)

**Role:** Manage planner view scrolling, day loading, and observables

```typescript
@Injectable({ providedIn: 'root' })
export class PlannerService {
  static INITIAL_DAYS_DESKTOP = 15;
  static INITIAL_DAYS_MOBILE = 5;
  static AUTO_LOAD_INCREMENT = 7;

  // Observable: which days to display (respects day-of-week filter)
  daysToShow$: Observable<string[]>;

  // Main observable: PlannerDay[] with all computed data
  days$: Observable<PlannerDay[]> = this.daysToShow$.pipe(
    switchMap((daysToShow) =>
      combineLatest([
        this._store.select(selectAllTaskRepeatCfgs),
        this._store.select(selectTodayTaskIds),
        this._calendarIntegrationService.icalEvents$,
        this.allDueWithTimeTasks$,
        this._globalTrackingIntervalService.todayDateStr$,
      ]).pipe(
        switchMap(([taskRepeatCfgs, todayListTaskIds, icalEvents, ...]) =>
          this._store.select(
            selectPlannerDays(
              daysToShow,
              taskRepeatCfgs,
              todayListTaskIds,
              icalEvents,
              allTasksPlanned,
              todayStr,
            ),
          ),
        ),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // Convenience: get tomorrow's day
  tomorrow$ = this.days$.pipe(
    map((days) => {
      const tomorrowMs = Date.now() + 24 * 60 * 60 * 1000;
      const tomorrowStr = getDbDateStr(tomorrowMs);
      return days.find((d) => d.dayDate === tomorrowStr) ?? null;
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // Methods:
  getDayOnce$(dayStr: string): Observable<PlannerDay | undefined>;
  getSnackExtraStr(dayStr: string): Promise<string>;  // e.g., "∑ 5 tasks ｜ 2h 30m"
  loadMoreDays(): void;  // Increment days count + set userHasScrolled
  ensureDayLoaded(dayDate: string): void;  // Ensure specific day is in view
  resetScrollState(): void;  // Return to initial day count
}
```

### 4.2 ScheduleService (`schedule.service.ts`)

**Role:** Build schedule with blocked blocks (calendar events + work boundaries)

```typescript
@Injectable({ providedIn: 'root' })
export class ScheduleService {
  // Create computed schedule days signal-based
  createScheduleDaysComputed(daysToShow: Signal<string[]>): Signal<ScheduleDay[]>;

  // Build schedule days with manual parameters
  buildScheduleDays(params: {
    now?: number;
    realNow?: number;  // Actual current time for "current week" determination
    daysToShow: string[];
    timelineTasks: { planned: TaskWithDueTime[], unPlanned: Task[] };
    taskRepeatCfgs: { withStartTime, withoutStartTime };
    icalEvents: ScheduleCalendarMapEntry[];
    plannerDayMap: PlannerDayMap;
    timelineCfg?: ScheduleConfig;
    currentTaskId?: string | null;
  }): ScheduleDay[];

  // Helper: get day for an event
  getEventDayStr(ev: ScheduleEvent): string | null;
  
  // Helper: get days array for month view
  getMonthDaysToShow(
    numberOfWeeks: number,
    firstDayOfWeek: number = 0,
    referenceDate?: Date,
  ): string[];
}
```

**Internal Pipeline:**
```
buildScheduleDays()
  ↓
createBlockedBlocksByDayMap()  [Calendar + work boundaries]
  ↓
createScheduleDays()  [Place unscheduled tasks in free gaps]
  ↓
ScheduleDay[]  (with SVE entries for UI rendering)
```

### 4.3 Planning Mode Service (`planning-mode.service.ts`)

**Role:** Determine if morning briefing flow should activate

```typescript
@Injectable({ providedIn: 'root' })
export class PlanningModeService {
  static NO_PLANNING_MODE_HOUR = 15;  // After 3 PM, no auto-planning mode

  isPlanningMode: Signal<boolean> = computed(() => {
    // Manual planning mode OR
    // (No tasks in context AND before 3 PM)
    // BUT if user explicitly left, respect that
  });

  leavePlanningMode(): void;
  enterPlanningMode(): void;
  reCheckPlanningMode(): void;
}
```

### 4.4 Add Tasks For Tomorrow Service (`add-tasks-for-tomorrow.service.ts`)

**Role:** Move tasks due tomorrow into today's work context

```typescript
@Injectable({ providedIn: 'root' })
export class AddTasksForTomorrowService {
  nrOfPlannerItemsForTomorrow$: Observable<number>;  // Count of items due tomorrow

  async addAllDueTomorrow(): Promise<'ADDED' | void>;
  async addAllDueToday(): Promise<'ADDED' | void>;
  
  // Internal: moves planned tasks to today list
  private _movePlannedTasksToToday(plannedTasks: TaskCopy[]): void;
}
```

**Flow:**
1. Query repeat configs due tomorrow/today
2. Create instances (via `TaskRepeatCfgService.createRepeatableTask`)
3. Fetch all due tasks (dueWithTime + dueDay + repeats)
4. Filter out already-in-today
5. Sort by due time (time-based first, then all-day)
6. Dispatch `TaskSharedActions.planTasksForToday(taskIds)`

### 4.5 Before Finish Day Service (`before-finish-day.service.ts`)

**Role:** Hook system for end-of-day actions

```typescript
@Injectable({ providedIn: 'root' })
export class BeforeFinishDayService {
  private _actions: BeforeFinishDayAction[] = [];

  addAction(actionToAdd: BeforeFinishDayAction): void;
  async executeActions(): Promise<'SUCCESS' | 'ERROR'>;
}

export type BeforeFinishDayAction = () => Promise<'SUCCESS' | 'ERROR'>;
```

---

## 5. TASK ASSIGNMENT & DRAG-DROP SYSTEM

### 5.1 How Tasks Are Assigned to Days

**Two Mechanisms:**

#### A. **Planner-Based Assignment** (Explicit Day Planning)
```
User drags task → 
  Planner component dispatches PlannerActions.transferTask() →
    Reducer updates PlannerState.days[targetDay] ↔ Removes from prevDay →
      Selector rebuilds PlannerDay[] →
        UI displays in new day's column
```

**Actions Triggered:**
- `transferTask()` — Move between days/panels (persisted)
- `moveInList()` — Reorder within same day (persisted)
- `moveBeforeTask()` — Insert before specific task (persisted)
- `planTaskForDay()` — Plan single task for day (persisted)

#### B. **Due-Based Assignment** (Automatic)
```
Task has dueWithTime or dueDay →
  selectPlannerDays selector automatically filters by dayDate →
    Task appears in appropriate day column (read-only unless moved)
```

**Three-Level Task Organization:**

```typescript
// Level 1: TODAY (work context - top level)
- In TODAY tag's task list
- Dispatched via TaskSharedActions.addTasksToToday()

// Level 2: PLANNER (day-specific planning)
- In PlannerState.days[dayDate]
- Shows as task rows in day column
- Can be reordered via drag-drop

// Level 3: SCHEDULE (time-specific)
- Has dueWithTime (timestamp) OR in planner + dueDay
- Renders in timeline with specific hour block
- Blocked from other tasks (creates BlockedBlock entries)
```

### 5.2 Drag-Drop Implementation

**Technology:** Angular CDK Drag-Drop (`@angular/cdk/drag-drop`)

**Zones:**
- `CdkDropListGroup` — All day columns share drop zone
- Source: Any day column + ADD_TASK_PANEL
- Target: Any day column + ADD_TASK_PANEL + OVERDUE_LIST

**Payload:** `TaskCopy` (full task object with all metadata)

---

## 6. PLANNING MODE FLOW (Morning Briefing)

**Location:** Morning briefing is triggered by `PlanningModeService.isPlanningMode`

### 6.1 Auto-Planning Trigger Conditions

```typescript
isPlanningMode = computed(() => {
  // Enter auto-planning if:
  return (
    (manualPlanningMode ||                    // User clicked "Enter planning mode" OR
    (!hasTasksToWorkOn && !isPastCutoff))     // No tasks in context AND before 3 PM
  ) && !userHasChosenToLeave;                 // User didn't explicitly leave
});
```

### 6.2 Planning Mode Flow Steps

**Inferred from code architecture:**

1. **Detection** → PlanningModeService detects empty context before 3 PM
2. **UI Signal** → Components react to `isPlanningMode` signal becoming true
3. **Pre-Flight Briefing** → `AddTasksForTomorrowService.addAllDueToday()`
   - Show count of items due today via `nrOfPlannerItemsForTomorrow$`
   - Call to move all due tasks into TODAY tag
4. **Manual Review** → User sees TODAY column with all due items
5. **Optional Scheduling** → User can drag tasks into specific day columns
6. **Exit Planning Mode** → User clicks "Leave" or adds first task

---

## 7. FINISH-DAY / DEBRIEF FLOW

**Location:** `finish-day-before-close.effects.ts`

### 7.1 Trigger Condition (Electron Only)

```typescript
scheduleUnscheduleFinishDayBeforeClose$ = 
  IS_ELECTRON &&
  createEffect(() =>
    this.isEnabled$.pipe(
      tap((isEnabled) =>
        isEnabled
          ? this._execBeforeCloseService.schedule(EXEC_BEFORE_CLOSE_ID)
          : this._execBeforeCloseService.unschedule(EXEC_BEFORE_CLOSE_ID),
      ),
    ),
    { dispatch: false },
  );
```

**Configuration:**
- Global config: `misc.isConfirmBeforeExitWithoutFinishDay` (boolean toggle)

### 7.2 Finish-Day Check Flow

When user closes app:

```typescript
warnToFinishDayBeforeClose$ =
  this.isEnabled$ &&
  onBeforeClose$ →
    Fetch workContext.taskIds →
      Get tasks for those IDs →
        Count doneTasks = tasks.filter(t => t.isDone) →
          IF doneTasks.length > 0:
            Show dialog: "You have X completed tasks. Finish day first?"
            YES → Navigate to /tag/TODAY/daily-summary
            NO → Allow close
          ELSE:
            Allow close
```

### 7.3 Data Collected During Finish-Day

**Inferred from `BeforeFinishDayService`:**

- List of completed tasks (via `isDone` flag)
- Count of tasks completed
- Timestamp of debrief
- Delegated to hook system via `BeforeFinishDayAction` callbacks

**Hooks can add:**
- Daily summary note (via `DailySummaryNote`)
- Time tracking totals
- Productivity metrics
- Export operations

---

## 8. CALENDAR EVENT INTEGRATION

### 8.1 Calendar Event Data Flow

```
CalendarIntegrationService.icalEvents$
  ↓
ScheduleFromCalendarEvent[] (ical parsed)
  ↓
Planner selector: getIcalEventsForDay()
  ├─ Filter by dayDate
  ├─ Separate: allDayEvents vs. timedEvents
  └─ Create ScheduleItemEvent (with timestamps)
  ↓
PlannerDay:
  ├─ allDayEvents: ScheduleFromCalendarEvent[] (no time)
  └─ scheduledIItems: ScheduleItemEvent[] (with times)
  ↓
Schedule service: createBlockedBlocksByDayMap()
  ├─ Creates BlockedBlock entries for timed events
  └─ Prevents task scheduling during calendar events
```

### 8.2 Calendar Event Types in Planner

```typescript
export interface ScheduleFromCalendarEvent extends CalendarIntegrationEvent {
  icon?: string;
}

// Rendered as:
export interface ScheduleItemEvent extends ScheduleItemBase {
  type: ScheduleItemType.CalEvent;
  start: number;        // Unix timestamp of event start
  end: number;          // Unix timestamp of event end
  calendarEvent: {
    title: string;
    duration: number;   // ms
    provider?: any;
    ico?: string;
  };
}
```

### 8.3 Calendar Impact on Available Hours

```typescript
// In createBlockedBlocksByDayMap():
// 1. Collect all calendar events for day
// 2. Sort by time
// 3. Create BlockedBlock entries
// 4. When placing tasks: skip occupied time slots

// In getTasksWithinAndBeyondBudget():
// Count = (availableHours - sum(blockedBlockDurations))
// Tasks beyond this count = beyondBudgetTasks (shown separately)
```

---

## 9. REPEAT TASK HANDLING

### 9.1 Repeat Task Types in Planner

```typescript
export interface NoStartTimeRepeatProjection {
  id: string;
  repeatCfg: TaskRepeatCfg;
  // No scheduled time - rendered as list item, not timeline block
}

export interface ScheduleItemRepeatProjection extends ScheduleItemBase {
  type: ScheduleItemType.RepeatProjection;
  repeatCfg: TaskRepeatCfg;
  start: number;  // Unix timestamp (parsed from repeatCfg.startTime)
  end: number;    // start + repeatCfg.defaultEstimate
}
```

### 9.2 Repeat Task Processing

```typescript
// In planner selector getPlannerDay():
const { repeatProjectionsForDay, noStartTimeRepeatProjections } =
  getAllRepeatableTasksForDay(taskRepeatCfgs, currentDayTimestamp);

// Separates:
// - WITH startTime → ScheduleItemRepeatProjection (timeline block)
// - WITHOUT startTime → NoStartTimeRepeatProjection (list item)
```

---

## 10. SCHEDULE MAPPING ALGORITHM

**Location:** `schedule/map-schedule-data/map-to-schedule-days.ts`

### 10.1 High-Level Pipeline

```typescript
mapToScheduleDays(
  now: number,
  dayDates: string[],
  tasks: Task[],                      // Unscheduled tasks
  scheduledTasks: TaskWithDueTime[],  // Tasks with dueWithTime
  scheduledTaskRepeatCfgs,
  unScheduledTaskRepeatCfgs,
  calendarWithItems: ScheduleCalendarMapEntry[],
  currentId: string | null,
  plannerDayMap: PlannerDayMap,
  workStartEndCfg,
  lunchBreakCfg,
  realNow,
): ScheduleDay[]

↓

1. createBlockedBlocksByDayMap()
   ├─ Collect all time-blocking items:
   │  ├─ Scheduled tasks (dueWithTime)
   │  ├─ Scheduled repeat projections
   │  ├─ Calendar events
   │  └─ Work start/end + lunch break
   ├─ Sort by start time
   └─ Create BlockedBlockByDayMap: { dayStr: BlockedBlock[] }

2. createScheduleDays()
   ├─ For each dayDate:
   │  ├─ Get unscheduled tasks from flowTasksLeftAfterDay
   │  ├─ Get repeat projections due that day
   │  ├─ Place in free gaps between blocked blocks
   │  ├─ Split if task spans multiple days
   │  └─ Create ScheduleDay with all SVE entries
   └─ Return ScheduleDay[]
```

### 10.2 Task Placement Algorithm

```typescript
// createScheduleDays() builds entries for a day:

const blockedBlocks = blockerBlocksDayMap[dayDate] || [];
// blockedBlocks = [
//   { start: 09:00, end: 10:30, entries: [...calendar events] },
//   { start: 12:00, end: 13:00, entries: [...lunch break] },
//   { start: 14:00, end: 15:30, entries: [...scheduled task] }
// ]

// Algorithm (simplified):
let currentTime = dayStart;
for (const task of tasksForDay) {
  const taskDuration = task.timeEstimate - task.timeSpent;
  
  // Find next free gap
  while (currentTime < dayEnd && isWithinBlockedBlock(currentTime)) {
    currentTime = nextBlockedBlockEnd(currentTime);
  }
  
  const availableTime = dayEnd - currentTime;
  if (availableTime >= SCHEDULE_TASK_MIN_DURATION_IN_MS) {
    // Place task
    createViewEntry({
      start: currentTime,
      end: Math.min(currentTime + taskDuration, dayEnd),
      task
    });
    currentTime += taskDuration;
  } else {
    // Overflow - add to beyondBudgetTasks
  }
}
```

### 10.3 Split Task Handling

When task spans multiple days:

```typescript
// Task: 5 hours, placed at 3 PM on Monday (2 hours available)
// Result:
// Monday: SplitTask (3 PM - 5 PM, 2 hours)
// Tuesday: SplitTaskContinued (start - 3 hours remaining)
// Or if finishes Tuesday: SplitTaskContinuedLast

// SVE types track continuation:
export enum SVEType {
  SplitTask = 'SplitTask',           // First segment
  SplitTaskContinued = 'SplitTaskContinued',  // Middle segments
  SplitTaskContinuedLast = 'SplitTaskContinuedLast',  // Final segment
}
```

### 10.4 Render Order

```typescript
export const SCHEDULE_VIEW_TYPE_ORDER = {
  [SVEType.WorkdayStart]: 1,                         // Top
  [SVEType.WorkdayEnd]: 2,
  [SVEType.ScheduledTask]: 3,                        // Scheduled items
  [SVEType.ScheduledRepeatProjection]: 3,
  [SVEType.CalendarEvent]: 3,
  [SVEType.RepeatProjection]: 4,
  [SVEType.Task]: 5,                                 // Unscheduled placed
  [SVEType.TaskPlannedForDay]: 7,                    // Planned for day
  [SVEType.SplitTask]: 7,
  [SVEType.RepeatProjectionSplit]: 8,
  [SVEType.SplitTaskPlannedForDay]: 9,
  [SVEType.RepeatProjectionSplitContinued]: 10,
  [SVEType.SplitTaskContinued]: 11,
  [SVEType.RepeatProjectionSplitContinuedLast]: 12,
  [SVEType.SplitTaskContinuedLast]: 13,
  [SVEType.LunchBreak]: 14,                          // Bottom
};
```

---

## 11. COMPONENT ARCHITECTURE

### 11.1 Planner Page Component (`planner.component.ts`)

**Responsibility:** Top-level container, cleanup, drag-drop group

```typescript
@Component({
  selector: 'planner',
  imports: [
    CdkDropListGroup,
    PlannerPlanViewComponent,
    CdkScrollable,
    PlannerCalendarNavComponent,
  ],
})
export class PlannerComponent {
  days = toSignal(this._plannerService.days$);
  daysWithTasks = computed(() => {
    // Return set of dayDates that have ≥1 task
  });

  constructor() {
    // Auto-cleanup: remove old/deleted tasks from planner
    this._store
      .select(selectTaskFeatureState)
      .subscribe((taskState) => {
        this._store.dispatch(
          PlannerActions.cleanupOldAndUndefinedPlannerTasks({
            today: this._dateService.todayStr(),
            allTaskIds: taskState.ids,
          }),
        );
      });
  }
}
```

### 11.2 Planner Task Row Component

**Pattern (inferred):**
- Input: `task: TaskCopy`, `dayDate: string`, `index: number`
- Output: `onMove`, `onDelete` events
- Child of day column list
- Drag handle enabled
- Shows time estimate + spent

---

## 12. DATA PERSISTENCE & SYNC

### 12.1 Operation Log Integration

All planner mutations are **persistent operations**:

```typescript
PlannerActions.planTaskForDay: {
  meta: {
    isPersistent: true,
    entityType: 'PLANNER',
    entityId: task.id,
    opType: OpType.Update,  // or Move
  }
}
```

**Synced:**
- ✅ `upsertPlannerDay()`
- ✅ `transferTask()`
- ✅ `moveInList()`
- ✅ `moveBeforeTask()`
- ✅ `planTaskForDay()`

**Not Synced (UI only):**
- ❌ `cleanupOldAndUndefinedPlannerTasks()`
- ❌ `updatePlannerDialogLastShown()`

### 12.2 Meta-Reducer Interactions

```typescript
// When task is scheduled with time:
TaskSharedActions.scheduleTaskWithTime(action) →
  Removes task from all plannerState.days[*] entries →
    Task now in schedule timeline instead
```

---

## 13. REACT/SUPABASE MIGRATION GUIDE

### 13.1 Supabase Tables Schema

```sql
-- Day Plans (equivalent to PlannerState.days)
CREATE TABLE day_plans (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  day_date DATE NOT NULL,  -- "YYYY-MM-DD"
  task_ids TEXT[] NOT NULL DEFAULT '{}',  -- Ordered array
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(user_id, day_date)
);

-- Tasks (extended)
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  title TEXT NOT NULL,
  due_with_time BIGINT,  -- Unix ms, nullable
  due_day DATE,           -- "YYYY-MM-DD", nullable
  time_estimate INT,      -- ms
  time_spent INT,         -- ms
  time_spent_on_day JSONB DEFAULT '{}',  -- { "2024-03-20": 1800000 }
  is_done BOOLEAN DEFAULT false,
  done_on BIGINT,         -- Unix ms, nullable
  project_id UUID NOT NULL,
  parent_id UUID,
  sub_task_ids UUID[] DEFAULT '{}',
  tag_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Schedule Config
CREATE TABLE schedule_configs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  is_work_start_end_enabled BOOLEAN DEFAULT false,
  work_start TEXT,        -- "HH:mm"
  work_end TEXT,          -- "HH:mm"
  is_lunch_break_enabled BOOLEAN DEFAULT false,
  lunch_break_start TEXT, -- "HH:mm"
  lunch_break_end TEXT,   -- "HH:mm"
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(user_id)
);

-- Repeat Task Configurations
CREATE TABLE repeat_tasks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  title TEXT NOT NULL,
  start_time TEXT,        -- "HH:mm" for scheduled repeats
  default_estimate INT,   -- ms
  recurrence_rule TEXT,   -- RRULE format
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Calendar Events (sync from external sources)
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  title TEXT NOT NULL,
  start_time BIGINT NOT NULL,  -- Unix ms
  duration INT NOT NULL,       -- ms
  is_all_day BOOLEAN DEFAULT false,
  provider TEXT,               -- 'google', 'outlook', etc.
  icon TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  -- Index for fast day lookup
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_calendar_events_user_day 
  ON calendar_events(user_id, DATE(start_time));
```

### 13.2 React Hooks

```typescript
// Core planner hook
useDayPlan(dayDate: string): {
  tasks: Task[];
  scheduledItems: ScheduleItem[];
  availableHours: number;
  progressPercentage: number;
  isLoading: boolean;
  error: Error | null;
}

// Available hours calculation
useAvailableHours(dayDate: string): number;

// Schedule visualization
useScheduleDay(dayDate: string): {
  entries: SVE[];
  blockedBlocks: BlockedBlock[];
  beyondBudgetTasks: Task[];
}

// Task assignment
useTransferTask(
  taskId: string,
  fromDay: string,
  toDay: string,
  toIndex: number
): { mutate: () => Promise<void> };

// Planning mode
usePlanningMode(): {
  isPlanningMode: boolean;
  enter: () => void;
  leave: () => void;
  tasksDueToday: Task[];
}

// Finish day debrief
useFinishDayActions(): {
  addAction: (action: BeforeFinishDayAction) => void;
  executeAll: () => Promise<'SUCCESS' | 'ERROR'>;
}
```

### 13.3 React Components

```typescript
// Main planner view
<DayPlannerView
  startDate={Date}
  numberOfDays={15}
  onTaskMoved={(task, fromDay, toDay) => {}}
/>

// Day column
<DayPlanColumn
  dayDate="2024-03-20"
  tasks={tasks}
  availableHours={28800000}  // ms
  onTaskDrop={(task, index) => {}}
/>

// Timeline view
<TimelineView
  dayDate="2024-03-20"
  entries={scheduleEntries}
  workStart="09:00"
  workEnd="17:30"
/>

// Task row
<TaskRow
  task={task}
  dayDate="2024-03-20"
  onDragStart={(task) => {}}
/>
```

### 13.4 Key State Management Pattern

```typescript
// Using Zustand or Jotai
export const dayPlanStore = create((set) => ({
  plannerDays: {} as Record<string, string[]>,  // dayDate -> [taskIds]
  
  // Actions
  planTask: (taskId: string, dayDate: string, index: number) =>
    set((state) => ({
      plannerDays: {
        ...state.plannerDays,
        [dayDate]: insertAtIndex(
          state.plannerDays[dayDate] || [],
          taskId,
          index
        ),
      },
    })),
  
  moveTask: (taskId: string, fromDay: string, toDay: string, toIndex: number) =>
    set((state) => ({
      plannerDays: {
        ...state.plannerDays,
        [fromDay]: state.plannerDays[fromDay].filter(id => id !== taskId),
        [toDay]: insertAtIndex(
          state.plannerDays[toDay] || [],
          taskId,
          toIndex
        ),
      },
    })),
}));
```

---

## 14. KEY ARCHITECTURAL PATTERNS & DECISIONS

| Pattern | Implementation | Notes |
|---------|---|---|
| **Mutual Exclusivity** | `dueWithTime` XOR `dueDay` (check dueWithTime first) | Prevents scheduling ambiguity |
| **State Shape** | `PlannerDayMap: { dayDate: string[] }` | Minimal state, max selectivity |
| **Computed Hours** | `calculateAvailableHours()` per-day | Includes lunch break deduction |
| **Blocked Blocks** | `BlockedBlockByDayMap` (time ranges) | Prevents task overlap |
| **Split Tasks** | Span multiple days via `SplitTask*` types | Handles overflow gracefully |
| **Virtual TODAY Tag** | Tasks move via action, not drag to TODAY | Work context explicitly separated |
| **Repeat Projections** | Separated: with startTime vs without | Different rendering per type |
| **Calendar Integration** | Creates `BlockedBlock` entries | External events impact scheduling |
| **Progress Tracking** | `progressPercentage = timeEstimate / availableHours` | Visual capacity indicator |
| **Planning Mode Trigger** | Auto when empty context + before 3 PM | Respects user's "leave" choice |

---

## 15. CRITICAL CALCULATION FORMULAS

```typescript
// 1. Available Hours
availableHours = (workEnd - workStart) - (lunchEnd - lunchStart)
  where: all times are Unix ms on the same day

// 2. Progress Percentage
progressPercentage = (timeEstimate / availableHours) * 100

// 3. Task Duration Remaining
remainingDuration = Math.max(timeEstimate - timeSpent, 0)

// 4. Time Spent Today
timeSpentToday = timeSpentOnDay[dayDateStr] || 0

// 5. Schedule Block Occupancy
occupiedTime = sum of all (BlockedBlock.end - BlockedBlock.start) for day

// 6. Available Scheduling Time
availableSchedulingTime = availableHours - occupiedTime

// 7. Current Week Boundary
currentWeekEnd = today + 7 days (at midnight)

// 8. Task Min Duration
SCHEDULE_TASK_MIN_DURATION_IN_MS = 10 * 60 * 1000 + 1  // 10m + 1ms
```

---

## SUMMARY FOR SALESBLOCK IMPLEMENTATION

**Key Takeaways for React/Supabase:**

1. **Planner State:** Minimal `{ dayDate: taskIds[] }` map
2. **Available Hours:** Calculate per-day based on work hours minus lunch
3. **Task Assignment:** Support both drag-drop (planner) and automatic (due dates)
4. **Schedule Visualization:** Build blocked blocks first, then place unscheduled tasks
5. **Planning Mode:** Auto-trigger for pre-work briefing, manual override respected
6. **Finish-Day Flow:** Confirm completed tasks, trigger debrief hook system
7. **Data Sync:** Persist all planner mutations as operations (for eventual multi-device sync)
8. **Calendar:** Integrate as time-blocking (prevents task scheduling)

The system is **highly modular**: planner, schedule, and planning mode can be implemented independently, then connected via shared task/day state.
