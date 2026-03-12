"use client";

/**
 * @crumb shared-dashboard-error-boundary
 * @id jobtrackr.components.shared.dashboard-error-boundary
 * @intent Reusable error boundary UI for all dashboard route segments
 * @responsibilities
 *   DashboardErrorBoundary: logs error via logError with route context on mount,
 *   renders error card with retry button calling Next.js reset()
 * @contracts
 *   - Props: error (Error & { digest?: string }), reset (() => void), context (string), message? (string)
 *   - context: route identifier passed to logError (e.g. "AnalyticsPage")
 *   - message: optional user-facing description (defaults to generic)
 * @hazards
 *   - logError is fire-and-forget — if it throws, error is silently lost
 * @area Components/Shared
 * @refs @jobtrackr/ui (Button), @/lib/utils/error-handler (logError)
 * @prompt
 *   - @fix DX-1 — extracted from 9 identical error.tsx files into single shared component
 */

import { useEffect } from "react";
import { Button } from "@jobtrackr/ui";
import { logError } from "@/lib/utils/error-handler";

interface DashboardErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
  context: string;
  message?: string;
}

export function DashboardErrorBoundary({
  error,
  reset,
  context,
  message = "We had trouble loading this page. This is usually temporary. Please try again, and if the problem persists, refresh the page.",
}: DashboardErrorBoundaryProps) {
  useEffect(() => {
    logError(error, context);
  }, [error, context]);

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-12 text-center">
        <span className="material-symbols-outlined text-destructive" style={{ fontSize: '48px' }}>error</span>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          Something went wrong
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {message}
        </p>
        <Button onClick={reset} className="mt-6">
          Try Again
        </Button>
      </div>
    </div>
  );
}
