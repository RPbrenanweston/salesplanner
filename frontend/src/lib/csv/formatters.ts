/**
 * Domain-specific CSV row formatters
 *
 * Each formatter takes a SalesBlock domain object and returns
 * a flat Record<string, string> suitable for toCsvString/downloadCsv.
 */

import type { Contact, Deal, Activity } from "../../types"

export function formatContactForCsv(contact: Contact): Record<string, string> {
  return {
    "First Name": contact.first_name ?? "",
    "Last Name": contact.last_name ?? "",
    "Email": contact.email ?? "",
    "Phone": contact.phone ?? "",
    "Company": contact.company ?? "",
    "Title": contact.title ?? "",
    "Source": contact.source ?? "",
    "Created": contact.created_at
      ? new Date(contact.created_at).toLocaleDateString()
      : "",
  }
}

export function formatDealForCsv(deal: Deal): Record<string, string> {
  return {
    "Deal Title": deal.title ?? "",
    "Value": deal.value != null
      ? `${deal.currency ?? "USD"} ${deal.value.toLocaleString()}`
      : "",
    "Stage ID": deal.stage_id ?? "",
    "Close Date": deal.close_date
      ? new Date(deal.close_date).toLocaleDateString()
      : "",
    "Notes": deal.notes ?? "",
    "Created": deal.created_at
      ? new Date(deal.created_at).toLocaleDateString()
      : "",
  }
}

export function formatActivityForCsv(activity: Activity): Record<string, string> {
  const contactName = activity.contact
    ? `${activity.contact.first_name} ${activity.contact.last_name}`.trim()
    : ""

  return {
    "Type": activity.type ?? "",
    "Contact": contactName,
    "Outcome": activity.outcome ?? "",
    "Notes": activity.notes ?? "",
    "Duration (s)": activity.duration_seconds != null
      ? String(activity.duration_seconds)
      : "",
    "Date": activity.created_at
      ? new Date(activity.created_at).toLocaleDateString()
      : "",
  }
}
