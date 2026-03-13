/**
 * Generic CSV export utilities
 *
 * Client-side CSV generation and browser download trigger.
 * Works with any Record<string, string>[] data — domain-specific
 * formatting lives in formatters.ts.
 *
 * Includes UTF-8 BOM prefix for Excel compatibility.
 */

const BOM = "\uFEFF"

function escapeCsvField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Convert an array of flat row objects into a CSV string.
 * Keys of the first row become headers. All values are escaped.
 * Prepends UTF-8 BOM so Excel renders non-ASCII characters correctly.
 */
export function toCsvString(rows: Record<string, string>[]): string {
  if (rows.length === 0) return BOM

  const headers = Object.keys(rows[0])
  const headerRow = headers.map(escapeCsvField).join(",")
  const dataRows = rows.map((row) =>
    headers.map((h) => escapeCsvField(row[h] ?? "")).join(",")
  )

  return BOM + headerRow + "\n" + dataRows.join("\n")
}

/**
 * Trigger a browser file download for the given CSV rows.
 *
 * Client-side only — uses DOM APIs (createElement, click).
 * Will throw in SSR/server contexts.
 */
export function downloadCsv(
  rows: Record<string, string>[],
  filename = "salesblock-export.csv"
): void {
  if (typeof document === "undefined") {
    throw new Error("downloadCsv requires a browser environment (DOM access)")
  }

  const csvString = toCsvString(rows)
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.style.display = "none"

  document.body.appendChild(link)
  link.click()

  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
