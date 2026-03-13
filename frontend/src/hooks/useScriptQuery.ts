/** @id salesblock.hooks.scripts.use-script-query */
// @crumb frontend-hook-use-script-query
// DAT | script_caching | template_caching | call_prep_data | email_template_loading
// why: React Query wrappers for call scripts and email templates — caches per user, deduplicates requests, manages 5min stale windows
// in:userId (optional),scriptId/templateId (optional) out:CallScript[]/EmailTemplate[]/single script/template,TanStack Query state err:fetch failure,userId undefined on useCallScripts/Emails still fetches (should be disabled)
// hazard: useCallScripts and useEmailTemplates don't disable query when userId undefined — will still attempt fetch with undefined, likely returning empty or error
// hazard: No script content validation — if script contains forbidden content (slurs, company secrets), no client-side check before rendering in UI
// edge:frontend/src/lib/queries/scriptQueries.ts -> CALLS
// edge:frontend/src/pages/CallPrepPage.tsx -> CALLS
// edge:frontend/src/components/ScriptSelector.tsx -> CALLS
// edge:content-delivery#1 -> STEP_IN
// prompt: Add enabled: !!userId check to useCallScripts/useEmailTemplates. Add validation layer to reject scripts with content policies violated. Test with 1k+ scripts for memory.
/**
 * React Query hooks for script and template data fetching
 */
import { useQuery } from '@tanstack/react-query'
import {
  fetchCallScripts,
  fetchCallScript,
  fetchEmailTemplates,
  fetchEmailTemplate,
  CallScript,
  EmailTemplate,
} from '../lib/queries/scriptQueries'

export function useCallScripts(userId?: string | undefined) {
  return useQuery<CallScript[]>({
    queryKey: ['call-scripts', userId],
    queryFn: () => fetchCallScripts(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCallScript(scriptId: string | undefined) {
  return useQuery<CallScript | null>({
    queryKey: ['call-script', scriptId],
    queryFn: () => (scriptId ? fetchCallScript(scriptId) : null),
    enabled: !!scriptId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useEmailTemplates(userId?: string | undefined) {
  return useQuery<EmailTemplate[]>({
    queryKey: ['email-templates', userId],
    queryFn: () => fetchEmailTemplates(userId),
    staleTime: 5 * 60 * 1000,
  })
}

export function useEmailTemplate(templateId: string | undefined) {
  return useQuery<EmailTemplate | null>({
    queryKey: ['email-template', templateId],
    queryFn: () => (templateId ? fetchEmailTemplate(templateId) : null),
    enabled: !!templateId,
    staleTime: 5 * 60 * 1000,
  })
}
