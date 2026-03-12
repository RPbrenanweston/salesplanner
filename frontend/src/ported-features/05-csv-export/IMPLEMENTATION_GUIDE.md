# 05 — CSV Export

## Source
**From:** JobTrackr `src/lib/csv/export.ts`

## What You Get

Client-side CSV export utility with:
- Row formatter (`formatJobForCsv`) — maps domain objects to flat CSV rows
- CSV string generator (`jobsToCsvString`) — handles headers, escaping, quoting
- Browser download trigger (`downloadCsv`) — creates Blob, triggers download via anchor click
- **Zero external dependencies** — pure TypeScript

## Files Copied

| Source File | Purpose |
|---|---|
| `source/export.ts` | 3 functions: formatForCsv, toCsvString, downloadCsv |

## Implementation Steps

### Step 1: Rework the Row Formatter

JobTrackr's `formatJobForCsv` maps Job objects to CSV columns. Replace with SalesBlock domain objects.

**Contacts export:**
```typescript
function formatContactForCsv(contact: Contact): Record<string, string> {
  return {
    "First Name": contact.first_name ?? "",
    "Last Name": contact.last_name ?? "",
    "Email": contact.email ?? "",
    "Phone": contact.phone ?? "",
    "Company": contact.company ?? "",
    "Title": contact.title ?? "",
    "Status": contact.status ?? "",
    "Source": contact.source ?? "",
    "Created": contact.created_at ? new Date(contact.created_at).toLocaleDateString() : "",
    "Last Activity": contact.last_activity_at ? new Date(contact.last_activity_at).toLocaleDateString() : "",
  }
}
```

**Deals export:**
```typescript
function formatDealForCsv(deal: Deal): Record<string, string> {
  return {
    "Deal Name": deal.name ?? "",
    "Company": deal.company ?? "",
    "Value": deal.value ? `$${deal.value.toLocaleString()}` : "",
    "Stage": deal.stage ?? "",
    "Owner": deal.owner_name ?? "",
    "Close Date": deal.close_date ? new Date(deal.close_date).toLocaleDateString() : "",
    "Created": deal.created_at ? new Date(deal.created_at).toLocaleDateString() : "",
  }
}
```

**Activity export:**
```typescript
function formatActivityForCsv(activity: Activity): Record<string, string> {
  return {
    "Type": activity.type ?? "",
    "Contact": activity.contact_name ?? "",
    "Subject": activity.subject ?? "",
    "Date": activity.created_at ? new Date(activity.created_at).toLocaleDateString() : "",
    "Outcome": activity.outcome ?? "",
  }
}
```

### Step 2: Keep the Generic CSV Utilities

`toCsvString` and `downloadCsv` are generic — they work with any `Record<string, string>[]` array. Only changes needed:

1. Remove `@jobtrackr/types` import
2. Rename functions to be generic:
   - `jobsToCsvString` → `toCsvString`
   - `downloadCsv` — keep name, change default filename

```typescript
export function downloadCsv(
  rows: Record<string, string>[],
  filename = "salesblock-export.csv"
): void {
  const csvString = toCsvString(rows)
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
```

### Step 3: Add UTF-8 BOM for Excel (Fix Known Hazard)

The @crumb metadata flags: "no UTF-8 BOM for Excel." Fix this:

```typescript
// In toCsvString, prepend BOM:
const BOM = "\uFEFF"
return BOM + headerRow + "\n" + dataRows.join("\n")
```

### Step 4: Place in SalesBlock Structure

```
frontend/src/lib/csv/
├── export.ts          (generic toCsvString + downloadCsv)
└── formatters.ts      (formatContactForCsv, formatDealForCsv, formatActivityForCsv)
```

### Step 5: Wire to UI

Add export buttons to list pages:

```typescript
// ContactsList.tsx
<Button onClick={() => {
  const rows = contacts.map(formatContactForCsv)
  downloadCsv(rows, `contacts-${new Date().toISOString().split("T")[0]}.csv`)
}}>
  Export CSV
</Button>
```

## Dependencies

**None.** Pure TypeScript, browser-only APIs (Blob, URL.createObjectURL).

## Hazards (from @crumb metadata)

- `downloadCsv` uses DOM APIs (createElement, click) — **client-side only**, will crash in SSR/Edge Functions
- No UTF-8 BOM — Excel may display garbled characters for non-ASCII data. Fix in Step 3 above.
- String escaping uses basic quote-wrapping — handles commas and quotes but doesn't handle newlines within cell values

## Estimated Effort
**Low** — 1-2 hours. Generic utilities copy directly. Only the row formatters need rewriting for SalesBlock types.
