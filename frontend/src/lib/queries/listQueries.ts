/**
 * Contact list data fetching functions
 */
import { supabase } from '../supabase'
import type { ContactList } from '../../types'

export type { ContactList }

export async function fetchUserLists(userId: string): Promise<ContactList[]> {
  const { data, error } = await supabase
    .from('lists')
    .select('id, name, description, owner_id, is_shared')
    .or(`owner_id.eq.${userId},is_shared.eq.true`)
    .order('name')

  if (error) {
    console.error('Error fetching lists:', error)
    return []
  }

  return data || []
}

export async function fetchList(listId: string): Promise<ContactList | null> {
  const { data, error } = await supabase
    .from('lists')
    .select('*')
    .eq('id', listId)
    .single()

  if (error) {
    console.error('Error fetching list:', error)
    return null
  }

  return data
}

export async function fetchListContacts(listId: string) {
  const { data, error } = await supabase
    .from('list_contacts')
    .select(`
      contact_id,
      contact:contacts(id, first_name, last_name, email, phone, company, title)
    `)
    .eq('list_id', listId)
    .order('position', { ascending: true })

  if (error) {
    console.error('Error fetching list contacts:', error)
    return []
  }

  return data || []
}

export async function fetchListContactCount(listId: string): Promise<number> {
  const { count, error } = await supabase
    .from('list_contacts')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', listId)

  if (error) {
    console.error('Error fetching contact count:', error)
    return 0
  }

  return count || 0
}

export async function createList(
  userId: string,
  orgId: string,
  list: Partial<ContactList>
): Promise<ContactList | null> {
  const { data, error } = await supabase
    .from('lists')
    .insert({
      name: list.name,
      description: list.description,
      owner_id: userId,
      org_id: orgId,
      is_shared: list.is_shared ?? false,
      filter_criteria: list.filter_criteria,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating list:', error)
    return null
  }

  return data
}

export async function updateList(listId: string, updates: Partial<ContactList>): Promise<boolean> {
  const { error } = await supabase
    .from('lists')
    .update(updates)
    .eq('id', listId)

  if (error) {
    console.error('Error updating list:', error)
    return false
  }

  return true
}
