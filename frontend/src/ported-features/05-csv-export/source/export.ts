/**
 * @crumb csv-export
 * @id salesblock.lib.csv.export
 * @intent Generate CSV strings from job data and trigger browser file downloads for job export
 * @responsibilities
 *   formatJobForCsv(job): Converts a single Job to an array of escaped CSV field strings
 *   jobsToCsvString(jobs): Generates a complete CSV string with headers and data rows
 *   downloadCsv(jobs, filename?): Creates a Blob, triggers browser download via hidden anchor element
 *   Exports CSV_HEADERS constant for column definitions
 * @contracts
 *   formatJobForCsv(job: Job): string[]
 *   jobsToCsvString(jobs: Job[]): string
 *   downloadCsv(jobs: Job[], filename?: string): void
 *   downloadCsv uses DOM APIs (document.createElement) — client-side only
 * @hazards
 *   downloadCsv accesses document directly — will throw in SSR/server context
 *   No BOM prefix for UTF-8 CSV — Excel on Windows may misinterpret special characters
 *   URL.createObjectURL memory not guaranteed to release if revokeObjectURL fails
 * @area Lib/CSV
 * @refs @/types (Job, STATUS_LABELS)
 * @prompt
 *   Add UTF-8 BOM prefix (\uFEFF) for Excel compatibility
 *   Guard downloadCsv with typeof document check for SSR safety
 */
import type { Job } from "@/types";
import { STATUS_LABELS } from "@/types";

// ─── Constants ──────────────────────────────────────────────────────────────────

export const CSV_HEADERS = [
  "Company",
  "Title",
  "Status",
  "Applied Date",
  "Salary Min",
  "Salary Max",
  "Location",
  "Source",
  "URL",
] as const;

// ─── CSV Field Escaping ─────────────────────────────────────────────────────────

function escapeCsvField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── Format Single Job ──────────────────────────────────────────────────────────

export function formatJobForCsv(job: Job): string[] {
  return [
    escapeCsvField(job.company),
    escapeCsvField(job.title),
    STATUS_LABELS[job.status],
    job.applied_date ?? "",
    job.salary_min !== null ? String(job.salary_min) : "",
    job.salary_max !== null ? String(job.salary_max) : "",
    job.location !== null ? escapeCsvField(job.location) : "",
    job.source !== null ? escapeCsvField(job.source) : "",
    job.url !== null ? escapeCsvField(job.url) : "",
  ];
}

// ─── Generate Full CSV String ───────────────────────────────────────────────────

export function jobsToCsvString(jobs: Job[]): string {
  const headerRow = CSV_HEADERS.join(",");
  const dataRows = jobs.map((job) => formatJobForCsv(job).join(","));
  return [headerRow, ...dataRows].join("\n");
}

// ─── Trigger Browser Download ───────────────────────────────────────────────────

export function downloadCsv(jobs: Job[], filename?: string): void {
  const csvContent = jobsToCsvString(jobs);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename ?? `salesblock-export-${new Date().toISOString().split("T")[0]}.csv`;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
