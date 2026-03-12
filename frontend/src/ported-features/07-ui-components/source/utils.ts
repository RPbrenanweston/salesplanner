/**
 * @crumb
 * @id jobtrackr-ui-utils
 * @intent Compose Tailwind CSS class names with conflict resolution — merge Tailwind utilities, remove duplicates, apply class variance authority patterns
 * @responsibilities cn() function uses clsx to concatenate class names + twMerge to resolve Tailwind specificity conflicts (e.g., w-1/3 overrides w-1/2)
 * @contracts Exports cn() function signature: (...inputs: ClassValue[]) => string; accepts clsx-compatible inputs (strings, objects, arrays); returns merged class string
 * @hazards clsx and tailwind-merge are external dependencies — missing from package.json breaks compilation; CVA (class-variance-authority) patterns rely on cn() for variant composition — every UI component indirectly depends on this function; order of inputs matters in edge cases where Tailwind specificity rules conflict
 * @area UI
 * @refs packages/ui/src/index.ts, clsx (npm), tailwind-merge (npm), all components (button.tsx, card.tsx, etc.)
 * @prompt This utility function is foundational to all Tailwind-based styling. Do not modify without regression testing all components. If performance profiling shows cn() is a bottleneck, consider memoization for static classname compositions. Keep dependency versions synced with Tailwind config changes.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
