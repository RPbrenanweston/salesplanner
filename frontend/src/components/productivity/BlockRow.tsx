/** @id salesblock.components.productivity.block-row */
import { cn } from "../../lib/utils";
import {
  Phone,
  Mail,
  Linkedin,
  Calendar,
  Search,
  Briefcase,
  Coffee,
  Play,
  Check,
  X,
} from "lucide-react";
import type { ProductivityBlock, BlockType, BlockStatus } from "../../types/productivity";

interface BlockRowProps {
  block: ProductivityBlock;
  isDragging?: boolean;
  onEdit?: (id: string) => void;
  onComplete?: (id: string) => void;
  onSkip?: (id: string) => void;
  onStartTimer?: (id: string) => void;
  isActive?: boolean;
  contactName?: string;
}

const BLOCK_TYPE_ICONS: Record<BlockType, React.ElementType> = {
  call: Phone,
  email: Mail,
  linkedin: Linkedin,
  meeting: Calendar,
  research: Search,
  admin: Briefcase,
  break: Coffee,
};

const BLOCK_TYPE_COLORS: Record<BlockType, string> = {
  call: "text-blue-500 bg-blue-500/10 dark:text-blue-400 dark:bg-blue-500/15",
  email: "text-violet-500 bg-violet-500/10 dark:text-violet-400 dark:bg-violet-500/15",
  linkedin: "text-sky-500 bg-sky-500/10 dark:text-sky-400 dark:bg-sky-500/15",
  meeting: "text-amber-500 bg-amber-500/10 dark:text-amber-400 dark:bg-amber-500/15",
  research: "text-emerald-500 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/15",
  admin: "text-gray-500 bg-gray-500/10 dark:text-gray-400 dark:bg-gray-500/15",
  break: "text-orange-500 bg-orange-500/10 dark:text-orange-400 dark:bg-orange-500/15",
};

const STATUS_BADGES: Record<BlockStatus, { label: string; classes: string }> = {
  planned: {
    label: "Planned",
    classes: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/50",
  },
  active: {
    label: "Active",
    classes: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400",
  },
  paused: {
    label: "Paused",
    classes: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  },
  completed: {
    label: "Done",
    classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  skipped: {
    label: "Skipped",
    classes: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400",
  },
};

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function BlockRow({
  block,
  isDragging = false,
  onEdit,
  onComplete,
  onSkip,
  onStartTimer,
  isActive = false,
  contactName,
}: BlockRowProps) {
  const Icon = BLOCK_TYPE_ICONS[block.block_type];
  const iconColor = BLOCK_TYPE_COLORS[block.block_type];
  const statusBadge = STATUS_BADGES[block.status];
  const isActionable = block.status === "planned" || block.status === "active";

  return (
    <div
      className={cn(
        "glass-card flex items-center gap-3 px-4 py-3 transition-all duration-150 group",
        isDragging && "shadow-xl scale-[1.02] ring-2 ring-indigo-500/30 dark:ring-indigo-400/30",
        isActive &&
          "ring-2 ring-indigo-500 dark:ring-indigo-400 neon-glow-indigo",
        !isDragging && !isActive && "hover:shadow-md dark:hover:bg-white/[0.07]",
        (block.status === "completed" || block.status === "skipped") && "opacity-60",
      )}
      role="button"
      tabIndex={0}
      onClick={() => onEdit?.(block.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit?.(block.id);
        }
      }}
    >
      {/* Block type icon */}
      <div
        className={cn(
          "flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg",
          iconColor,
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium truncate text-gray-900 dark:text-white",
              (block.status === "completed" || block.status === "skipped") && "line-through",
            )}
          >
            {block.title}
          </span>
          <span
            className={cn(
              "flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
              statusBadge.classes,
            )}
          >
            {statusBadge.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500 dark:text-white/40">
            {formatDuration(block.duration_estimate_ms)}
          </span>
          {contactName && (
            <>
              <span className="text-xs text-gray-300 dark:text-white/20">|</span>
              <span className="text-xs text-gray-500 dark:text-white/40 truncate">
                {contactName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {isActionable && (
        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onStartTimer && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartTimer(block.id);
              }}
              aria-label="Start timer"
              className="flex items-center justify-center h-7 w-7 rounded-md bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-400 dark:hover:bg-indigo-500/25 transition-colors"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          {onComplete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onComplete(block.id);
              }}
              aria-label="Mark complete"
              className="flex items-center justify-center h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:hover:bg-emerald-500/25 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          {onSkip && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSkip(block.id);
              }}
              aria-label="Skip block"
              className="flex items-center justify-center h-7 w-7 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/25 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default BlockRow;
