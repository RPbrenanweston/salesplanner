'use client'

/** @id salesblock.components.productivity.timer-widget */
import { cn } from "../../lib/utils";
import {
  Play,
  Pause,
  Square,
  SkipForward,
  Timer,
  Flame,
  Hourglass,
  Zap,
} from "lucide-react";
import type { FocusMode, FocusState } from "../../types/productivity";

interface TimerWidgetProps {
  state: FocusState;
  mode: FocusMode;
  elapsedMs: number;
  targetMs: number | null;
  cycle: number;
  totalCycles: number;
  onStart: (mode: string, targetMs?: number) => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onStartBreak: () => void;
  onSkipBreak: () => void;
  compact?: boolean;
}

const MODE_LABELS: Record<FocusMode, string> = {
  pomodoro: "Pomodoro",
  flowtime: "Flowtime",
  countdown: "Countdown",
  sprint: "Sprint",
};

const MODE_ICONS: Record<FocusMode, React.ElementType> = {
  pomodoro: Timer,
  flowtime: Flame,
  countdown: Hourglass,
  sprint: Zap,
};

const FOCUS_MODES: FocusMode[] = ["pomodoro", "flowtime", "countdown", "sprint"];

function formatTime(ms: number, forceHours = false): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hours > 0 || forceHours) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function computeProgress(elapsedMs: number, targetMs: number | null): number {
  if (targetMs === null || targetMs <= 0) return 0;
  return Math.min(elapsedMs / targetMs, 1);
}

const RING_RADIUS = 80;
const RING_STROKE = 6;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_SIZE = (RING_RADIUS + RING_STROKE) * 2;

function ProgressRing({
  progress,
  isBreak,
  compact,
}: {
  progress: number;
  isBreak: boolean;
  compact?: boolean;
}) {
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  const scale = compact ? 0.6 : 1;
  const size = RING_SIZE * scale;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      className="transform -rotate-90"
    >
      {/* Background track */}
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={RING_STROKE}
        className="text-gray-200 dark:text-white/10"
      />
      {/* Progress arc */}
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
        className={cn(
          "transition-[stroke-dashoffset] duration-500 ease-linear",
          isBreak
            ? "stroke-cyan-400 dark:stroke-cyan-400"
            : "stroke-indigo-500 dark:stroke-indigo-400",
        )}
      />
    </svg>
  );
}

export function TimerWidget({
  state,
  mode,
  elapsedMs,
  targetMs,
  cycle,
  totalCycles,
  onStart,
  onPause,
  onResume,
  onComplete,
  onCancel,
  onStartBreak: _onStartBreak,
  onSkipBreak,
  compact = false,
}: TimerWidgetProps) {
  const progress = computeProgress(elapsedMs, targetMs);
  const isBreak = state === "break";
  const ModeIcon = MODE_ICONS[mode];

  const displayTime =
    targetMs !== null && state !== "completed"
      ? formatTime(Math.max(targetMs - elapsedMs, 0))
      : formatTime(elapsedMs);

  return (
    <div
      className={cn(
        "glass-card flex flex-col items-center gap-4",
        compact ? "p-4" : "p-6",
      )}
    >
      {/* Mode indicator */}
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-white/50">
        <ModeIcon className="h-4 w-4" />
        <span>{MODE_LABELS[mode]}</span>
        {mode === "pomodoro" && (
          <span className="text-xs text-gray-400 dark:text-white/30">
            Cycle {cycle}/{totalCycles}
          </span>
        )}
      </div>

      {/* Ring + time display */}
      <div className="relative flex items-center justify-center">
        <ProgressRing progress={progress} isBreak={isBreak} compact={compact} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-mono font-semibold tabular-nums text-gray-900 dark:text-white",
              compact ? "text-xl" : "text-3xl",
            )}
          >
            {displayTime}
          </span>
          <StateLabel state={state} compact={compact} />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {state === "idle" && <IdleControls mode={mode} onStart={onStart} compact={compact} />}
        {state === "running" && (
          <RunningControls onPause={onPause} onCancel={onCancel} compact={compact} />
        )}
        {state === "paused" && (
          <PausedControls onResume={onResume} onCancel={onCancel} compact={compact} />
        )}
        {state === "break" && (
          <BreakControls onSkipBreak={onSkipBreak} compact={compact} />
        )}
        {state === "completed" && (
          <CompletedControls
            elapsedMs={elapsedMs}
            onComplete={onComplete}
            compact={compact}
          />
        )}
      </div>
    </div>
  );
}

function StateLabel({ state, compact }: { state: FocusState; compact?: boolean }) {
  const labels: Record<FocusState, string> = {
    idle: "Ready",
    running: "Focus",
    paused: "Paused",
    break: "Break",
    completed: "Done!",
  };

  const colors: Record<FocusState, string> = {
    idle: "text-gray-400 dark:text-white/40",
    running: "text-indigo-500 dark:text-indigo-400",
    paused: "text-amber-500 dark:text-amber-400",
    break: "text-cyan-500 dark:text-cyan-400",
    completed: "text-emerald-500 dark:text-emerald-400",
  };

  return (
    <span
      className={cn(
        "font-medium",
        compact ? "text-xs mt-0.5" : "text-sm mt-1",
        colors[state],
      )}
    >
      {labels[state]}
    </span>
  );
}

function ControlButton({
  onClick,
  variant = "default",
  compact,
  children,
  label,
}: {
  onClick: () => void;
  variant?: "primary" | "danger" | "default" | "success";
  compact?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  const variantClasses = {
    primary:
      "bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-indigo-500 dark:hover:bg-indigo-400",
    danger:
      "bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400",
    success:
      "bg-emerald-500 hover:bg-emerald-600 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400",
    default:
      "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white/70",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex items-center justify-center rounded-lg transition-colors",
        compact ? "h-8 w-8" : "h-10 w-10",
        variantClasses[variant],
      )}
    >
      {children}
    </button>
  );
}

function IdleControls({
  mode,
  onStart,
  compact,
}: {
  mode: FocusMode;
  onStart: (mode: string, targetMs?: number) => void;
  compact?: boolean;
}) {
  const iconSize = compact ? 16 : 18;

  return (
    <div className="flex items-center gap-2">
      {!compact && (
        <div className="flex items-center gap-1 mr-2">
          {FOCUS_MODES.map((m) => {
            const Icon = MODE_ICONS[m];
            return (
              <button
                key={m}
                type="button"
                onClick={() => onStart(m)}
                aria-label={`Start ${MODE_LABELS[m]}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  m === mode
                    ? "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
                    : "text-gray-500 hover:bg-gray-100 dark:text-white/40 dark:hover:bg-white/10",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {MODE_LABELS[m]}
              </button>
            );
          })}
        </div>
      )}
      {compact && (
        <ControlButton
          onClick={() => onStart(mode)}
          variant="primary"
          compact={compact}
          label="Start timer"
        >
          <Play className="h-4 w-4" style={{ width: iconSize, height: iconSize }} />
        </ControlButton>
      )}
    </div>
  );
}

function RunningControls({
  onPause,
  onCancel,
  compact,
}: {
  onPause: () => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  const iconSize = compact ? 14 : 16;

  return (
    <>
      <ControlButton onClick={onPause} variant="default" compact={compact} label="Pause timer">
        <Pause style={{ width: iconSize, height: iconSize }} />
      </ControlButton>
      <ControlButton onClick={onCancel} variant="danger" compact={compact} label="Stop timer">
        <Square style={{ width: iconSize, height: iconSize }} />
      </ControlButton>
    </>
  );
}

function PausedControls({
  onResume,
  onCancel,
  compact,
}: {
  onResume: () => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  const iconSize = compact ? 14 : 16;

  return (
    <>
      <ControlButton onClick={onResume} variant="primary" compact={compact} label="Resume timer">
        <Play style={{ width: iconSize, height: iconSize }} />
      </ControlButton>
      <ControlButton onClick={onCancel} variant="danger" compact={compact} label="Stop timer">
        <Square style={{ width: iconSize, height: iconSize }} />
      </ControlButton>
    </>
  );
}

function BreakControls({
  onSkipBreak,
  compact,
}: {
  onSkipBreak: () => void;
  compact?: boolean;
}) {
  const iconSize = compact ? 14 : 16;

  return (
    <ControlButton
      onClick={onSkipBreak}
      variant="default"
      compact={compact}
      label="Skip break"
    >
      <SkipForward style={{ width: iconSize, height: iconSize }} />
    </ControlButton>
  );
}

function CompletedControls({
  elapsedMs,
  onComplete,
  compact,
}: {
  elapsedMs: number;
  onComplete: () => void;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {!compact && (
        <p className="text-xs text-gray-500 dark:text-white/40">
          Total: {formatTime(elapsedMs, true)}
        </p>
      )}
      <ControlButton onClick={onComplete} variant="success" compact={compact} label="Finish">
        <Play style={{ width: compact ? 14 : 16, height: compact ? 14 : 16 }} />
      </ControlButton>
    </div>
  );
}

export default TimerWidget;
