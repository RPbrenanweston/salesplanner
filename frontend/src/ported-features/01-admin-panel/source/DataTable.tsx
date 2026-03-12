/**
 * @crumb data-table-generic
 * @intent Generic, reusable admin data table with search, sort, pagination, loading states, and custom cell rendering
 * @responsibilities Filter/sort data based on search/sortKey/sortDir state, render header with sortable indicators, tbody with data rows or loading skeletons, optional actions column
 * @contracts Props: { data: T[], columns: TableColumn<T>[], searchable?: boolean, searchPlaceholder?: string, emptyMessage?: string, loading?: boolean, actions?: (row: T) => React.ReactNode } | Generic: <T extends object>
 * @hazards Search case-insensitive but uses String() coercion—null/undefined silently convert to ""; sort uses localeCompare (locale-dependent), not numeric; custom render callbacks don't have validation—type errors surface at render time
 * @area admin-ui/tables
 * @refs types (TableColumn generic), cn utility, Material Symbols search icon, AdminLayout (container)
 * @prompt Consider numeric column detection for smarter sort (e.g., 100 > 20). Validate col.render callback return type matches React.ReactNode. Add aria-sort attributes for screen reader accessibility.
 */

"use client"

import { useState } from "react"
import { cn } from "./utils"
import type { TableColumn } from "./types"

interface DataTableProps<T extends object> {
  data: T[]
  columns: TableColumn<T>[]
  searchable?: boolean
  searchPlaceholder?: string
  emptyMessage?: string
  loading?: boolean
  actions?: (row: T) => React.ReactNode
}

export function DataTable<T extends object>({
  data,
  columns,
  searchable = false,
  searchPlaceholder = "Search...",
  emptyMessage = "No records found.",
  loading = false,
  actions,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const filtered = searchable
    ? data.filter((row) =>
        Object.values(row).some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(search.toLowerCase())
        )
      )
    : data

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const ar = a as Record<string, unknown>
        const br = b as Record<string, unknown>
        const av = String(ar[sortKey] ?? "")
        const bv = String(br[sortKey] ?? "")
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    : filtered

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  return (
    <div className="bg-white/65 backdrop-blur-md rounded-[12px] border border-black/[0.08] overflow-hidden">
      {searchable && (
        <div className="px-4 py-3 border-b border-black/[0.06]">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-[6px] text-sm font-mono text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#10b77f]/30"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.06]">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                  className={cn(
                    "px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-slate-400",
                    col.sortable && "cursor-pointer select-none hover:text-slate-600"
                  )}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === String(col.key) && (
                      <span className="material-symbols-outlined text-[12px] text-[#10b77f]">
                        {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              {actions && (
                <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-slate-400">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="border-b border-black/[0.04] last:border-0">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3">
                      <div className="h-4 rounded bg-slate-100 animate-pulse" />
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3">
                      <div className="h-4 w-16 rounded bg-slate-100 animate-pulse ml-auto" />
                    </td>
                  )}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-8 text-center text-slate-400 font-mono text-[11px]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-black/[0.04] last:border-0 hover:bg-slate-50/50 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className="px-4 py-3 text-slate-700"
                    >
                      {col.render
                        ? col.render(row[col.key as keyof T], row)
                        : String(row[col.key as keyof T] ?? "—")}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right">{actions(row)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
