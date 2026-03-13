/**
 * @crumb
 * @id salesblock-ui-toaster
 * @intent Orchestrate toast notification rendering from state — map notifications from hook into composed Toast + slot elements + ToastProvider wrapper
 * @responsibilities toast provider composition (ToastProvider → [Toast.map] → ToastViewport), state consumption (useToast), title/description conditional rendering, action slot composition
 * @contracts Exports Toaster function component (no props); consumes Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport from ./toast; consumes useToast() hook return {toasts, dismiss}
 * @hazards "use client" directive — cannot be used in Server Components; assumes Toast/ToastViewport/etc exported from ./toast (circular dependency risk if ./toast imports Toaster); ToastProvider must wrap entire toasts.map or context breaks; grid-gap-1 layout assumes flex children
 * @area UI
 * @refs packages/ui/src/toast.tsx, packages/ui/src/hooks/use-toast.ts, packages/ui/src/index.ts
 * @prompt When adding new toast features (e.g., toast position, custom actions), extend Toaster's map destructuring and Toast props. Do not modify useToast hook signature without updating Toaster's return statement. Keep ToastViewport below all Toast elements for stacking order.
 */

"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast";
import { useToast } from "./hooks/use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
