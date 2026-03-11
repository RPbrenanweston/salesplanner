import { supabase } from '../supabase'
import type { ResearchEntry, ResearchCategory, ResearchLevel } from '../../types/domain'

/** Fetch research for a contact (contact-level + company-level by company name) */
export async function getResearchForContact(
  contactId: string,
  companyName: string | undefined
): Promise<{ contactEntries: ResearchEntry[]; companyEntries: ResearchEntry[] }> {
  // Contact-level entries
  const { data: contactEntries, error: contactError } = await supabase
    .from('research_entries')
    .select('*')
    .eq('contact_id', contactId)
    .eq('level', 'contact')
    .order('created_at', { ascending: false })

  if (contactError) throw contactError

  // Company-level entries (by company_name, not contact_id)
  let companyEntries: ResearchEntry[] = []
  if (companyName) {
    const { data, error } = await supabase
      .from('research_entries')
      .select('*')
      .eq('company_name', companyName)
      .eq('level', 'company')
      .order('created_at', { ascending: false })

    if (error) throw error
    companyEntries = (data || []) as ResearchEntry[]
  }

  return {
    contactEntries: (contactEntries || []) as ResearchEntry[],
    companyEntries,
  }
}

/** Create a research entry */
export async function createResearchEntry(params: {
  orgId: string
  contactId?: string | null
  companyName: string
  level: ResearchLevel
  category: ResearchCategory
  content: string
  createdBy: string
}): Promise<ResearchEntry> {
  const { data, error } = await supabase
    .from('research_entries')
    .insert({
      org_id: params.orgId,
      contact_id: params.contactId || null,
      company_name: params.companyName,
      level: params.level,
      category: params.category,
      content: params.content,
      created_by: params.createdBy,
    })
    .select()
    .single()

  if (error) throw error
  return data as ResearchEntry
}

/** Delete a research entry */
export async function deleteResearchEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from('research_entries')
    .delete()
    .eq('id', entryId)

  if (error) throw error
}

/** Category display config */
export const RESEARCH_CATEGORY_CONFIG: Record<
  ResearchCategory,
  { label: string; icon: string }
> = {
  news: { label: 'News', icon: '📰' },
  pain_points: { label: 'Pain Points', icon: '🎯' },
  tech_stack: { label: 'Tech Stack', icon: '🔧' },
  funding: { label: 'Funding', icon: '💰' },
  general: { label: 'General', icon: '📝' },
}
