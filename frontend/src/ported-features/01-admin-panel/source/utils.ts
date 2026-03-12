/**
 * @crumb class-name-utility
 * @intent Utility function for composing Tailwind CSS class names with conflict resolution
 * @responsibilities Combine classValue inputs using clsx, then resolve Tailwind conflicts with twMerge
 * @contracts cn(...inputs: ClassValue[]) => string | Takes array-like class inputs, returns merged class string
 * @hazards twMerge uses regex to detect/resolve Tailwind conflicts—custom CSS class names not prefixed with Tailwind will not merge correctly; performance cost increases with input count
 * @area admin-ui/utilities
 * @refs All admin components (cn() used in ToggleCard, StatCard, ConfirmDialog, DataTable, AdminNav)
 * @prompt Match pattern used in @jobtrackr/ui. If custom CSS classes conflict with Tailwind, add to twMerge safelist or rename classes. Monitor bundle size impact of regex matching.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
