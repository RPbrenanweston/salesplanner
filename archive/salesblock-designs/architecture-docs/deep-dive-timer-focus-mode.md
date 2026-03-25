## Comprehensive Architectural Analysis: Super Productivity Timer & Focus Mode System

### EXECUTIVE SUMMARY

The Super Productivity Timer & Focus Mode system is a sophisticated state machine built on NgRx with three distinct work modes (Pomodoro, Flowtime, Countdown), intelligent break management, task synchronization, and idle detection. The architecture emphasizes single-source-of-truth via the NgRx store, with effects handling side effects, and strict separation between timer logic, UI state, and task tracking.

---

## 1. TIMER STATE MACHINE & DATA STRUCTURES

### 1.1 Core Timer State
```typescript
// Single source of truth for all timing
interface TimerState {
  isRunning: boolean;           // Is timer currently active
  startedAt: number | null;     // Unix timestamp when started
  elapsed: number;              // Milliseconds accumulated since start
  duration: number;             // Target duration (0 = infinite for Flowtime)
  purpose: 'work' | 'break' | null;  // Current session type
  isLongBreak?: boolean;        // Pomodoro: true if long break
}
```

### 1.2 Focus Mode State Shape
```typescript
interface FocusModeState {
  timer: TimerState;                    // The heart of the system
  currentScreen: FocusScreen;           // UI screen enum (6 values)
  mainState: FocusMainUIState;          // UI state (3 values: Preparation/Countdown/InProgress)
  isOverlayShown: boolean;              // Full-screen overlay toggle
  mode: FocusModeMode;                  // Pomodoro/Flowtime/Countdown (persisted to localStorage)
  currentCycle: number;                 // Pomodoro cycle counter (1-based)
  lastCompletedDuration: number;        // Duration of last finished session (for metrics)
  pausedTaskId: string | null;          // Task ID to resume after break
  _isResumingBreak: boolean;            // Internal flag: break was just resumed
}
```

### 1.3 UI Screen States
```typescript
enum FocusScreen {
  TaskSelection = 'TaskSelection',       // Choose task (not yet implemented fully)
  DurationSelection = 'DurationSelection', // Set countdown duration
  Preparation = 'Preparation',          // Pre-session countdown display
  Main = 'Main',                        // Active session screen
  SessionDone = 'SessionDone',          // Post-session completion screen
  Break = 'Break',                      // Break screen
}

enum FocusMainUIState {
  Preparation = 'Preparation',          // Showing task/duration selection
  Countdown = 'Countdown',              // 5-second countdown before work
  InProgress = 'InProgress',            // Active session running
}
```

### 1.4 Focus Mode Configuration
```typescript
type FocusModeConfig = Readonly<{
  isSkipPreparation: boolean;           // Skip 5-sec countdown
  isPlayTick?: boolean;                 // Play ticking sound during work
  isPauseTrackingDuringBreak?: boolean; // Unset current task during breaks
  isSyncSessionWithTracking?: boolean;  // Pause work when user stops tracking task
  isStartInBackground?: boolean;        // Don't show overlay on task selection
  isManualBreakStart?: boolean;         // Manual vs auto break start
}>;
```

### 1.5 Pomodoro Configuration
```typescript
type PomodoroConfig = Readonly<{
  duration?: number | null;              // Work session (default: 25 * 60 * 1000)
  breakDuration?: number | null;         // Short break (default: 5 * 60 * 1000)
  longerBreakDuration?: number | null;   // Long break (default: 15 * 60 * 1000)
  cyclesBeforeLongerBreak?: number | null; // When to trigger long break (default: 4)
}>;
```

---

## 2. STATE MACHINE TRANSITIONS

### 2.1 Complete State Transition Map

```
IDLE → startFocusSession(duration?) → WORK_SESSION
  │
  └─ currentScreen: FocusScreen.Main
     mainState: FocusMainUIState.InProgress
     timer: { isRunning: true, purpose: 'work', elapsed: 0, duration: X }

WORK_SESSION:
  ├─ pauseFocusSession(pausedTaskId) → PAUSED_WORK
  │    (timer.isRunning = false, store pausedTaskId)
  │
  ├─ tick() [elapsed >= duration] → SESSION_COMPLETED
  │    (timer.isRunning = false, currentScreen: SessionDone)
  │
  └─ completeFocusSession(isManual=true) → SESSION_COMPLETED
       (immediately, regardless of elapsed time)

PAUSED_WORK:
  ├─ unPauseFocusSession() → WORK_SESSION (resume)
  └─ pauseFocusSession() → stays paused

SESSION_COMPLETED:
  ├─ [Pomodoro only] incrementCycle() → triggers: autoStartBreakOnSessionComplete$
  │
  ├─ startBreak(duration, isLongBreak?, pausedTaskId?) → BREAK
  │    (currentScreen: FocusScreen.Break)
  │
  ├─ startFocusSession(duration) → WORK_SESSION (new session)
  │
  └─ cancelFocusSession() → IDLE
       (clears timer, unsets current task, hides overlay)

BREAK:
  ├─ tick() [elapsed >= duration] → BREAK_TIME_UP
  │    (timer.isRunning = false, but stay on Break screen)
  │
  ├─ skipBreak(pausedTaskId?) → IDLE
  │    (auto-resume tracking if pausedTaskId exists)
  │
  ├─ completeBreak(pausedTaskId?) → IDLE
  │    (same as skipBreak, fires notification)
  │
  └─ pauseFocusSession(pausedTaskId) → PAUSED_BREAK
       (for manual pause during break)

PAUSED_BREAK:
  └─ unPauseFocusSession() → BREAK (resume)

IDLE → pauseFocusSession() or cancelFocusSession()
  └─ timer.purpose = null (timer has no effect)
```

### 2.2 Key Transitions & Their Triggers

| From | To | Trigger | Side Effects |
|------|----|---------|----|
| Idle | Preparation | startFocusPreparation | Show 5-sec countdown |
| Preparation | InProgress (Main) | onCountdownComplete | Start 1Hz timer tick |
| InProgress | Paused | pauseFocusSession | Unset currentTask (if sync enabled) |
| Paused | InProgress | unPauseFocusSession | Resume tracking (if pausedTaskId exists) |
| InProgress | SessionDone | tick [elapsed>=duration] | Increment cycle (Pomodoro), notify, log |
| SessionDone | Break | startBreak | Pause tracking if isPauseTrackingDuringBreak |
| SessionDone | InProgress (new) | startFocusSession | Reset timer, track task |
| Break | Idle | skipBreak/completeBreak | Resume pausedTaskId tracking |
| Break | Idle | cancelFocusSession | Force exit without notification |

### 2.3 Pomodoro Cycle Management

```
Cycle 1: Work(25m) → Break(5m)
Cycle 2: Work(25m) → Break(5m)
Cycle 3: Work(25m) → Break(5m)
Cycle 4: Work(25m) → LONG_BREAK(15m)
Cycle 5: Work(25m) → Break(5m)
... repeats every 4 cycles

Formula: isLong = (cycle % cyclesBeforeLongerBreak === 0)
When: After session complete → incrementCycle → cycle now = 4
Then: getBreakDuration(getBreakCycle(4)) = getBreakDuration(3) → NOT long
      getBreakDuration(4) → IS long
```

---

## 3. TIMER TICK MECHANICS

### 3.1 Timer Update Algorithm
```typescript
// Reducer tick handler (runs 1x/second from effects)
on(tick) → {
  if (!timer.isRunning || !timer.purpose) return;
  
  // Calculate elapsed since startedAt
  const now = Date.now();
  const elapsed = now - timer.startedAt;
  
  // Check for completion
  if (duration > 0 && elapsed >= duration) {
    // For work: stop timer, let effects dispatch completeFocusSession
    // For break: stop timer, let effects show "time's up" notification
    return { ...state, timer: { ...timer, isRunning: false } };
  }
  
  // Otherwise just update elapsed
  return { ...state, timer: { ...timer, elapsed } };
}
```

### 3.2 Tick Source & Frequency
```typescript
// FocusModeService constructor:
this._globalTrackingInterval.globalInterval$  // Shared 1Hz interval
  .pipe(
    filter(() => this.isRunning()),           // Only when timer active
    tap(() => this._store.dispatch(tick())),  // Dispatch tick action
  )
  .subscribe();

// Result: 1 action per second when timer is running
```

### 3.3 Progress Calculation
```typescript
selectProgress = (elapsed, duration) => {
  return duration > 0 ? (elapsed / duration) * 100 : 0;
}
// Flowtime: always returns 0 (no progress bar)
// Pomodoro/Countdown: 0-100%

selectTimeRemaining = (elapsed, duration) => {
  return Math.max(0, duration - elapsed);
}
```

---

## 4. FOCUS MODE STRATEGIES (Mode-Specific Behavior)

### 4.1 Pomodoro Strategy
```typescript
class PomodoroStrategy implements FocusModeStrategy {
  initialSessionDuration: 25 * 60 * 1000           // 25 minutes (configurable)
  shouldStartBreakAfterSession: true                // Always take breaks
  shouldAutoStartNextSession: true                  // Auto-continue after break
  
  getBreakDuration(cycle: number): { duration, isLong } {
    isLong = (cycle % 4 === 0)  // Long break every 4 sessions
    duration = isLong ? 15m : 5m
  }
}
```

### 4.2 Flowtime Strategy
```typescript
class FlowtimeStrategy implements FocusModeStrategy {
  initialSessionDuration: 0                         // Infinite (no duration limit)
  shouldStartBreakAfterSession: false               // No automatic breaks
  shouldAutoStartNextSession: false                 // Manual control only
  
  getBreakDuration(cycle): null                     // No breaks
  
  // UI: shows elapsed time (ticking up), no progress bar
}
```

### 4.3 Countdown Strategy
```typescript
class CountdownStrategy implements FocusModeStrategy {
  initialSessionDuration: lastCountdownDuration || 25m  // User-set duration
  shouldStartBreakAfterSession: false               // No automatic breaks
  shouldAutoStartNextSession: false                 // Manual control
  
  getBreakDuration(cycle): null                     // No breaks
  
  // UI: requires user to set duration before starting
}
```

---

## 5. EFFECT: STATE TRANSITIONS & SIDE EFFECTS

### 5.1 Session Start Effects Chain

```typescript
syncTrackingStartToSession$ - When task tracking starts:
  ├─ If work session paused: unPauseFocusSession()
  ├─ If break active: skipBreak() (unless _isResumingBreak flag set)
  └─ If no session: startFocusSession(strategy.initialSessionDuration)

syncSessionStartToTracking$ - When work session starts:
  └─ Resume pausedTaskId (if exists and undone)
     OR show overlay (if no valid task)

autoStartBreakOnSessionComplete$ - When session completes (Pomodoro only):
  ├─ Listen to: incrementCycle (after reducer has incremented)
  ├─ Calculate: breakInfo = strategy.getBreakDuration(cycle)
  ├─ If isPauseTrackingDuringBreak: unsetCurrentTask()
  └─ startBreak({ duration, isLongBreak, pausedTaskId })
```

### 5.2 Session Pause/Resume Effects

```typescript
syncTrackingStopToSession$ - When tracking stops (user clicks task X):
  └─ If work or break running: pauseFocusSession({ pausedTaskId })

syncSessionPauseToTracking$ - When work session paused:
  └─ unsetCurrentTask()

syncSessionResumeToTracking$ - When work session resumed:
  ├─ If break & isPauseTrackingDuringBreak: clearResumingBreakFlag()
  └─ Else if pausedTaskId exists: setCurrentTask({ id: pausedTaskId })
```

### 5.3 Break Completion Effects

```typescript
resumeTrackingOnBreakComplete$ - When break skipped/completed:
  └─ Resume pausedTaskId tracking (if not already tracking)

autoStartSessionOnBreakComplete$ - When break skipped/completed (Pomodoro):
  └─ startFocusSession(strategy.initialSessionDuration)  // Auto-continue

skipBreak$ - When user skips break:
  ├─ Resume pausedTaskId tracking (if configured)
  └─ Auto-start next session (if strategy allows)
```

### 5.4 Notification Effects

```typescript
notifyOnSessionComplete$ - Audio/visual notification
notifyOnBreakComplete$ - Audio/visual notification
detectSessionCompletion$ - When work timer completes
detectBreakTimeUp$ - When break timer completes (show "time's up")
```

### 5.5 UI Banner Updates

```typescript
updateBanner$ - Throttled to 500ms (timer ticks every 1s)
  Shows appropriate message based on:
  ├─ isSessionRunning: "Session Running - [time remaining]"
  ├─ isOnBreak: "Break [time remaining]" or "Break Time Is Up"
  ├─ isSessionCompleted: "Session Completed"
  └─ isSessionPaused: "Session Paused - [time remaining]"
  
  Action buttons vary by state:
  ├─ Play/Pause: In progress
  ├─ Start: After completion or break time up
  ├─ End Session: During work
  └─ Skip Break: During break
```

### 5.6 Idle Detection Effect

```typescript
pauseOnIdle$ - When idle dialog triggered:
  └─ pauseFocusSession({ pausedTaskId: currentTaskId })
     (preserves task to resume later)
```

### 5.7 Electron-Specific Effects

```typescript
setTaskBarProgress$ - Throttled to 500ms
  └─ window.ea.setProgressBar({ progress: 0-1, mode: 'normal'|'pause' })

focusWindowOnBreakStart$ - When break starts:
  └─ window.ea.showOrFocus()
     window.ea.flashFrame()
     Play notification sound
```

---

## 6. TIME TRACKING INTEGRATION

### 6.1 Time Tracking Model
```typescript
// Compressed storage format (dates as YYYY-MM-DD strings)
interface TTWorkContextData {
  s?: number;  // start time (unix timestamp)
  e?: number;  // end time (unix timestamp)
  b?: number;  // break count
  bt?: number; // break time (total ms)
}

interface TimeTrackingState {
  project: {
    [projectId]: {
      [dateStr]: TTWorkContextData
    }
  },
  tag: {
    [tagId]: {
      [dateStr]: TTWorkContextData
    }
  }
}
```

### 6.2 Time Accumulation Triggers

```typescript
// Time is tracked per:
1. Work Context (project OR tag)
2. Date (YYYY-MM-DD)
3. Session (work start → pause/end)

// When:
- Task tracking starts: record s (start)
- Task tracking stops: record e (end), calculate duration
- Break taken: increment b counter, add to bt total
- Day changes: create new date entry in same context
```

---

## 7. BREAK SYSTEM & "Take A Break" REMINDER

### 7.1 TakeABreakService Architecture

```typescript
// Break timer accumulation:
timeWorkingWithoutABreak$ = merge(
  this._tick$,        // Accumulate active work time
  this._triggerReset$, // Reset on break/manual reset
)

// Triggers:
1. Simple Break Reset: After 10+ minutes without task
   └─ threshold: BREAK_TRIGGER_DURATION = 10 * 60 * 1000

2. Idle-Aware Reset: System idle detected
   └─ from IdleService: isIdle$ with removeTimeSpent()

3. Manual Reset: User clicks "Already Took Break"
   └─ Adds 5 minutes to break time for work context

// Snooze: User can snooze reminder for N minutes
```

### 7.2 Break Trigger Configuration

```typescript
type TakeABreakConfig = Readonly<{
  isTakeABreakEnabled: boolean;
  isLockScreen: boolean;                  // Lock screen on break
  isTimedFullScreenBlocker: boolean;      // Fullscreen blocker (Electron)
  isFocusWindow: boolean;                 // Focus window
  takeABreakMessage: string;              // Custom message (e.g., "${duration} worked")
  takeABreakMinWorkingTime: number;       // Trigger threshold (e.g., 50 minutes)
  takeABreakSnoozeTime: number;           // Snooze duration (e.g., 15 minutes)
  motivationalImgs: (string | null)[];    // Random images on reminder
}>;
```

### 7.3 Break Trigger UX
```
Work 10+ min → Banner appears: "Take a break!"
  └─ Action 1: "Already Did" → adds 5m to break time, resets timer
  └─ Action 2: "Snooze" → banner dismisses for N minutes
  └─ Sound: configurable break reminder sound
  └─ Desktop notification: system notify
  └─ [Electron] Lock screen or fullscreen blocker
```

---

## 8. IDLE DETECTION SYSTEM

### 8.1 Idle Service

```typescript
// Core observables:
isIdle$: Observable<boolean>     // System idle detected
idleTime$: Observable<number>    // Idle duration in milliseconds
```

### 8.2 Idle Detection Flow

```typescript
triggerIdleWhenEnabled$:
  └─ _triggerIdleApis$ (from Electron IPC or Chrome extension)
     ├─ If isAlreadyIdle: skip (let internal poll timer handle)
     └─ If idleTimeInMs >= minIdleTime: dispatch triggerIdle()

handleIdleInit$:
  └─ When isIdle becomes true:
     ├─ Untrack current task (removeTimeSpent)
     ├─ Unset current task (tracking stops)
     ├─ Turn off simple counters
     ├─ Pause focus session (if running)
     ├─ Start internal idle timer poll (_initIdlePoll)
     └─ Open idle dialog

_initIdlePoll():
  └─ Poll every 1 second (IDLE_POLL_INTERVAL = 1000ms)
     ├─ Calculate: initialIdleTime + (Date.now() - idleStart)
     └─ Update store with new idle time (more accurate than IPC)
```

### 8.3 Idle Dialog & Result Handling

```typescript
DialogIdleComponent:
  Shows:
  ├─ Idle time (e.g., "Idle for 5 minutes")
  ├─ Last task (resumable)
  ├─ Enabled simple counters
  ├─ Radio options:
  │  ├─ Track to tasks (create new task or track to existing)
  │  ├─ Track to simple counters
  │  └─ Mark as break (5 minutes of break time)
  
  Returns: DialogIdleReturnData {
    trackItems: IdleTrackItem[],  // Tasks/breaks to track
    isResetBreakTimer: boolean,    // Reset break counter
  }

idleDialogResult$ effect:
  ├─ Cancel idle poll timer
  ├─ For BREAK items: addToBreakTimeForActiveContext()
  ├─ For TASK items: addTimeSpentAndSync() to tasks
  ├─ Resume simple counters (if applicable)
  ├─ [If focus session paused] Resume it
  └─ resetIdle()
```

### 8.4 Focus Mode × Idle Interaction

```typescript
When idle triggered during focus session:
1. pauseFocusSession({ pausedTaskId: currentTaskId })
   └─ Focus session pauses, task untracked

In idle dialog:
2. User marks idle as "Break" (5 min default)
   └─ Break time added to context

3. User resumes:
   └─ unPauseFocusSession() [from idle effect]
   └─ If focus session was running: resume it
   └─ If break was taken: break timer reset in TakeABreakService
```

---

## 9. CONFIGURATION & DEFAULTS

### 9.1 Focus Mode Defaults
```typescript
FOCUS_MODE_DEFAULTS = {
  SESSION_DURATION: 25 * 60 * 1000,      // 25 minutes
  SHORT_BREAK_DURATION: 5 * 60 * 1000,   // 5 minutes
  LONG_BREAK_DURATION: 15 * 60 * 1000,   // 15 minutes
  CYCLES_BEFORE_LONG_BREAK: 4,           // Every 4 sessions
} as const;
```

### 9.2 Idle Defaults
```typescript
DEFAULT_MIN_IDLE_TIME: 60 * 1000         // 1 minute system idle
IDLE_POLL_INTERVAL: 1 * 1000             // Update every 1 sec
```

### 9.3 Take A Break Defaults
```typescript
BREAK_TRIGGER_DURATION: 10 * 60 * 1000   // Suggest break after 10 min
PING_UPDATE_BANNER_INTERVAL: 60 * 1000   // Update every 60 sec
DESKTOP_NOTIFICATION_THROTTLE: 60 * 1000 // Notify every 60 sec max
LOCK_SCREEN_THROTTLE: 5 * 60 * 1000      // Lock every 5 min max
FULLSCREEN_BLOCKER_THROTTLE: 5 * 60 * 1000
```

---

## 10. ACTIONS & REDUCER COVERAGE

### 10.1 Complete Action List

**Core Lifecycle:**
- `focusModeLoaded()` - Initialize on app start
- `tick()` - Update timer (1x/sec)
- `setFocusModeMode(mode)` - Switch modes

**Session Control:**
- `startFocusSession(duration?)` - Begin work session
- `pauseFocusSession(pausedTaskId?)` - Pause (store task)
- `unPauseFocusSession()` - Resume
- `completeFocusSession(isManual?)` - End session
- `cancelFocusSession()` - Force exit

**Break Control:**
- `startBreak(duration?, isLongBreak?, pausedTaskId?)` - Begin break
- `skipBreak(pausedTaskId?)` - Skip break, resume task
- `completeBreak(pausedTaskId?)` - Break complete, resume task
- `exitBreakToPlanning(pausedTaskId?)` - Exit to planning screen

**Cycle Management (Pomodoro):**
- `incrementCycle()` - After session complete
- `resetCycles()` - Reset to 1

**Configuration:**
- `setFocusSessionDuration(focusSessionDuration)` - Set duration
- `adjustRemainingTime(amountMs)` - Add/subtract time (work only)
- `setPausedTaskId(pausedTaskId)` - Store task for resume

**UI Control:**
- `showFocusOverlay()` - Full-screen overlay
- `hideFocusOverlay()` - Close overlay
- `selectFocusTask()` - Task selection screen
- `selectFocusDuration()` - Duration selection screen
- `startFocusPreparation()` - 5-sec countdown
- `navigateToMainScreen()` - Main UI

**Internal:**
- `clearResumingBreakFlag()` - Housekeeping flag

---

## 11. KEY ALGORITHMS

### 11.1 Break Duration Calculation
```typescript
getBreakDuration(cycle: number) {
  const cyclesBeforeLong = config.cyclesBeforeLongerBreak || 4;
  const isLong = (cycle % cyclesBeforeLong === 0);
  
  // cycle is 0-indexed from last completed session
  // cycle=1: regular, cycle=2: regular, cycle=3: regular, cycle=4: LONG
  
  return {
    duration: isLong ? 15 * 60 * 1000 : 5 * 60 * 1000,
    isLong
  };
}

// Called with: getBreakCycle(currentCycle) = Math.max(currentCycle - 1, 1)
```

### 11.2 Session Completion Detection
```typescript
detectSessionCompletion$:
  └─ Listen to timer state changes
  ├─ Filter: purpose='work' && isRunning=false && elapsed >= duration
  ├─ Guard: duration > 0 (not Flowtime)
  └─ Dispatch: completeFocusSession({ isManual: false })
     (This triggers the full break/next-session flow)
```

### 11.3 Session Duration Sync
```typescript
syncDurationWithMode$:
  └─ When mode changes or focus loads:
  ├─ Skip if session already running (in-flight)
  ├─ For Flowtime: do nothing (duration = 0)
  └─ For Pomodoro/Countdown: sync to strategy.initialSessionDuration

syncDurationWithPomodoroConfig$:
  └─ When pomodoro config changes:
  ├─ Skip if session already running
  ├─ Only for Pomodoro mode
  └─ Set duration = pomodoroConfig.duration
```

---

## 12. TASK TRACKING × FOCUS MODE SYNC

### 12.1 isSyncSessionWithTracking Option

When enabled: Focus session ↔ Task tracking bidirectional sync

```
Task tracking starts (currentTaskId changes to X):
  └─ If no focus session: startFocusSession()
  └─ If paused: unPauseFocusSession()
  └─ If on break: skipBreak() (unless resuming)

Task tracking stops (currentTaskId → null):
  └─ If focus session running: pauseFocusSession(previousTaskId)
     (stores previousTaskId to resume after break)

Focus session pauses:
  └─ unsetCurrentTask() (tracking stops)

Focus session resumes:
  └─ setCurrentTask(pausedTaskId) (tracking resumes)
```

### 12.2 isPauseTrackingDuringBreak Option

When enabled:
```
Break starts:
  └─ unsetCurrentTask() (stop tracking during break)

Break ends:
  └─ resumeTrackingOnBreakComplete$ effect
     └─ setCurrentTask(pausedTaskId) (resume tracking)
```

---

## 13. PERSISTENCE & STORAGE

### 13.1 LocalStorage
```typescript
LS.FOCUS_MODE_MODE: string  // User's preferred mode (Pomodoro/Flowtime/Countdown)

// Countdown-specific:
FocusModeStorageService.getLastCountdownDuration()
  └─ Stored when user sets duration in Countdown mode
  └─ Restored when re-entering Countdown mode
```

### 13.2 IndexedDB (State Persistence)
```typescript
// Via NgRx store & operation log:
- TimerState (entire focus mode state)
- Time tracking data (TTWorkContextData per date/context)
- All synced across clients via operation log
```

---

## 14. REACT/SUPABASE PORT: CRITICAL PATTERNS

### 14.1 Required React Hooks Architecture

```typescript
// Core hooks (replicate NgRx + effects):
useTimer(options?: {
  initialDuration?: number,
  onComplete?: () => void
}) → {
  elapsed: number,
  remaining: number,
  progress: number,
  isRunning: boolean,
  pause: () => void,
  resume: () => void,
  complete: () => void,
  cancel: () => void,
  adjust: (amountMs: number) => void,
}

useFocusSession(mode: 'pomodoro' | 'flowtime' | 'countdown') → {
  // Combines timer + break logic for current mode
  state: 'idle' | 'working' | 'paused' | 'breaking' | 'completed',
  screen: FocusScreen,
  cycle: number,
  mode: FocusModeMode,
  
  startSession: (duration?: number) => void,
  pauseSession: (taskIdToResume?: string) => void,
  resumeSession: () => void,
  completeSession: (isManual?: boolean) => void,
  skipBreak: (resumeTaskId?: string) => void,
  
  // Effects subscriptions:
  onSessionComplete?: () => Promise<void>,
  onBreakStart?: () => Promise<void>,
}

useBreakReminder(config: TakeABreakConfig) → {
  workingTime: number,
  shouldShowBanner: boolean,
  snooze: (ms: number) => void,
  countAsBreak: () => void,
}

useIdleDetection(config: IdleConfig) → {
  isIdle: boolean,
  idleTime: number,
  minIdleTime: number,
  
  // Dialog result handling needed
  handleIdleDialogResult: (trackItems) => Promise<void>,
}
```

### 14.2 Supabase Tables Design

```sql
-- Session logs (one per focus session)
CREATE TABLE session_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  task_id UUID,  -- nullable for free-form sessions
  mode TEXT,  -- 'pomodoro' | 'flowtime' | 'countdown'
  duration_ms INT,
  elapsed_ms INT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  is_manual_end BOOLEAN,
  cycle_number INT,  -- Pomodoro cycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id, user_id)
);

-- Break sessions
CREATE TABLE break_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  session_log_id UUID REFERENCES session_logs(id),
  duration_ms INT,
  is_long_break BOOLEAN,
  elapsed_ms INT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  was_skipped BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id, user_id)
);

-- Time tracking entries (per work context × day)
CREATE TABLE time_tracking_entries (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  work_context_id UUID,  -- project or tag ID
  work_context_type TEXT,  -- 'project' | 'tag'
  tracked_date DATE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_ms INT,
  break_count INT DEFAULT 0,
  break_time_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, work_context_id, work_context_type, tracked_date)
);

-- Idle tracking (for analytics)
CREATE TABLE idle_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  idle_time_ms INT,
  was_tracked BOOLEAN,  -- Did user mark as break/task?
  tracked_items JSONB,  -- Serialized IdleTrackItem[]
  detected_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id, user_id)
);
```

### 14.3 State Management Pattern (Redux or Zustand)

```typescript
// Zustand store structure (matches NgRx):
type FocusStore = {
  // State
  timer: TimerState,
  currentScreen: FocusScreen,
  mainState: FocusMainUIState,
  mode: FocusModeMode,
  currentCycle: number,
  pausedTaskId: string | null,
  
  // Computed selectors
  isSessionRunning: () => boolean,
  progress: () => number,
  timeRemaining: () => number,
  
  // Actions
  startSession: (duration?) => void,
  pauseSession: (pausedTaskId?) => void,
  resumeSession: () => void,
  tick: () => void,
  
  // Effects hooks
  subscribeToCompletion: (cb) => unsubscribe,
  subscribeToBreakTrigger: (cb) => unsubscribe,
}
```

---

## 15. EDGE CASES & BUG FIXES (From Codebase)

### Bug #5995: Break Resume Flag
**Problem:** When resuming a break via manual tracking start, app treated it as new break
**Solution:** Store `_isResumingBreak` flag in state, clear it after processing
**Pattern:** Reducer sets flag, effect checks it, effect clears it

### Bug #5875: Manual Session End
**Problem:** Manual "End Session" during work didn't stop tracking
**Solution:** `stopTrackingOnSessionEnd$` effect checks `action.isManual` flag
**Pattern:** Actions carry metadata needed by effects

### Bug #6044: Cycle Race Condition
**Problem:** `completeFocusSession` fired before `incrementCycle`, break used wrong cycle
**Solution:** Auto-break effect listens to `incrementCycle` instead, guarantees cycle is updated
**Pattern:** Effects depend on reducer state changes, not action dispatch order

### Bug #5954: Tracking Pause During Break
**Problem:** If `isPauseTrackingDuringBreak=false`, tracking continued across break
**Solution:** Separate effect checks this config before unsetting task
**Pattern:** Config guards effect behavior

### Bug #6064: Break Timer Reset
**Problem:** "Take A Break" timer didn't reset when focus mode break started
**Solution:** `resetBreakTimerOnBreakStart$` signals `TakeABreakService.otherNoBreakTime$.next(0)`
**Pattern:** Inter-service communication via RxJS subjects

---

## 16. TESTING STRATEGY FOR REACT PORT

### Critical Test Scenarios

1. **Timer Precision**
   - Test tick interval (1Hz ±50ms)
   - Test elapsed vs duration calculation
   - Test progress quantization (0.1% precision)

2. **State Transitions**
   - All edges from state machine diagram
   - Pause/resume during work & break
   - Manual vs automatic completion

3. **Pomodoro Cycles**
   - Cycle increment on session complete
   - Break type correct (long every 4)
   - Cycle reset after user restarts

4. **Task Synchronization**
   - Session start/stop syncs to task tracking
   - pausedTaskId persists and resumes
   - No double-tracking when re-entering mode

5. **Idle Integration**
   - Pause focus session on idle trigger
   - Idle time accumulated correctly
   - Resume focus session after idle resolution

6. **Configuration**
   - Mode switch syncs duration
   - Pomodoro config changes apply
   - Skip preparation works

---

## SUMMARY TABLE: Key Metrics for Porting

| Metric | Value |
|--------|-------|
| **State properties** | 8 (timer + 7 UI/config) |
| **UI screens** | 6 (Task/Duration/Prep/Main/Done/Break) |
| **UI states** | 3 (Preparation/Countdown/InProgress) |
| **Focus modes** | 3 (Pomodoro/Flowtime/Countdown) |
| **Timer purposes** | 3 (work/break/null) |
| **Major effects** | 25+ (pause, resume, break, tracking sync, idle, notifications) |
| **Tick frequency** | 1 Hz (1000ms) |
| **Default session** | 25 minutes |
| **Break schedule** | 5m short, 15m long every 4 cycles |
| **Idle threshold** | 1 minute system idle |
| **Break reminder** | Every 50 minutes of work |
| **State updates/sec** | 2-3 (tick + effects dispatches) |

This architecture provides a battle-tested, production-grade timer system with sophisticated break management, task integration, and idle handling—ideal as a reference for your SalesBlock React port.
