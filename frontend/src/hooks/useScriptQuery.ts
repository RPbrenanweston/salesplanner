/** @id salesblock.hooks.scripts.use-script-query */
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
