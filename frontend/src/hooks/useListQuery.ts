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
