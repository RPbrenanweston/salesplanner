/**
 * Call script and email template data fetching functions
 */
import { supabase } from '../supabase'

export interface CallScript {
  id: string
  org_id: string
  name: string
  content: string
  owner_id: string
  is_shared: boolean
  created_at?: string
  updated_at?: string
}

export interface EmailTemplate {
  id: string
  org_id: string
  name: string
  subject: string
  body: string
  owner_id: string
  is_shared: boolean
  times_used?: number
  reply_count?: number
  created_at?: string
  updated_at?: string
}

export async function fetchCallScripts(userId?: string): Promise<CallScript[]> {
  let query = supabase
    .from('call_scripts')
    .select('id, name, content, owner_id, is_shared, org_id')

  if (userId) {
    query = query.or(`owner_id.eq.${userId},is_shared.eq.true`)
  }

  const { data, error } = await query.order('name')

  if (error) {
    console.error('Error fetching call scripts:', error)
    return []
  }

  return data || []
}

export async function fetchCallScript(scriptId: string): Promise<CallScript | null> {
  const { data, error } = await supabase
    .from('call_scripts')
    .select('*')
    .eq('id', scriptId)
    .single()

  if (error) {
    console.error('Error fetching call script:', error)
    return null
  }

  return data
}

export async function fetchEmailTemplates(userId?: string): Promise<EmailTemplate[]> {
  let query = supabase
    .from('email_templates')
    .select('id, name, subject, body, owner_id, is_shared, org_id, times_used, reply_count')

  if (userId) {
    query = query.or(`owner_id.eq.${userId},is_shared.eq.true`)
  }

  const { data, error } = await query.order('name')

  if (error) {
    console.error('Error fetching email templates:', error)
    return []
  }

  return data || []
}

export async function fetchEmailTemplate(templateId: string): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (error) {
    console.error('Error fetching email template:', error)
    return null
  }

  return data
}

export async function createCallScript(
  userId: string,
  orgId: string,
  script: Partial<CallScript>
): Promise<CallScript | null> {
  const { data, error } = await supabase
    .from('call_scripts')
    .insert({
      org_id: orgId,
      name: script.name,
      content: script.content,
      owner_id: userId,
      is_shared: script.is_shared ?? false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating call script:', error)
    return null
  }

  return data
}

export async function createEmailTemplate(
  userId: string,
  orgId: string,
  template: Partial<EmailTemplate>
): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      org_id: orgId,
      name: template.name,
      subject: template.subject,
      body: template.body,
      owner_id: userId,
      is_shared: template.is_shared ?? false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating email template:', error)
    return null
  }

  return data
}

export async function updateCallScript(scriptId: string, updates: Partial<CallScript>): Promise<boolean> {
  const { error } = await supabase
    .from('call_scripts')
    .update(updates)
    .eq('id', scriptId)

  if (error) {
    console.error('Error updating call script:', error)
    return false
  }

  return true
}

export async function updateEmailTemplate(
  templateId: string,
  updates: Partial<EmailTemplate>
): Promise<boolean> {
  const { error } = await supabase
    .from('email_templates')
    .update(updates)
    .eq('id', templateId)

  if (error) {
    console.error('Error updating email template:', error)
    return false
  }

  return true
}
