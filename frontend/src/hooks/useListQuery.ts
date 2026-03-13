/** @id salesblock.hooks.lists.use-list-query */
// @crumb frontend-hook-use-list-query
// DAT | list_data_fetching | contact_count_loading | query_caching | stale_time_management
// why: React Query wrapper hooks for contact list data — consolidates caching strategy and stale time config in one place for lists, contacts, and counts
// in:userId/listId (string|undefined),enabled state based on prop presence out:ContactList objects,contact array,count number,TanStack Query loading/error state err:fetch failure (network),Supabase read failure,stale data window (2-1 min)
// hazard: useUserLists doesn't filter archived lists — will include deleted/archived lists in query results unless handled upstream
// hazard: useListContacts loads all contacts into memory — for lists with 100k+ contacts, browser memory exhausted; no pagination
// edge:frontend/src/lib/queries/listQueries.ts -> CALLS
// edge:frontend/src/pages/ListDetailPage.tsx -> CALLS
// edge:data-fetching#1 -> STEP_IN
// prompt: Add cursor-based pagination for useListContacts (e.g., first 50, fetch more on scroll). Filter archived=false in useUserLists. Test with 100k+ contacts.
/**
 * React Query hooks for list data fetching
 */
import { useQuery } from '@tanstack/react-query'
import {
  fetchUserLists,
  fetchList,
  fetchListContacts,
  fetchListContactCount,
  ContactList,
} from '../lib/queries/listQueries'

export function useUserLists(userId: string | undefined) {
  return useQuery<ContactList[]>({
    queryKey: ['user-lists', userId],
    queryFn: () => (userId ? fetchUserLists(userId) : []),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

export function useList(listId: string | undefined) {
  return useQuery<ContactList | null>({
    queryKey: ['list', listId],
    queryFn: () => (listId ? fetchList(listId) : null),
    enabled: !!listId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useListContacts(listId: string | undefined) {
  return useQuery({
    queryKey: ['list-contacts', listId],
    queryFn: () => (listId ? fetchListContacts(listId) : []),
    enabled: !!listId,
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

export function useListContactCount(listId: string | undefined) {
  return useQuery<number>({
    queryKey: ['list-contact-count', listId],
    queryFn: () => (listId ? fetchListContactCount(listId) : 0),
    enabled: !!listId,
    staleTime: 1 * 60 * 1000,
  })
}
