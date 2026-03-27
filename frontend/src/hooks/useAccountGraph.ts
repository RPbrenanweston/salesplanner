/** @id salesblock.hooks.use-account-graph */
import { useQuery } from '@tanstack/react-query'
import { fetchAccountKnowledgeGraph } from '../lib/queries/graphQueries'
import type { AccountKnowledgeGraph } from '../types/graph'

/**
 * Fetches the full knowledge universe for a single account:
 * contacts, notes, signals, edges, and tags — everything needed
 * for the Knowledge Cloud visualization and AI context extraction.
 */
export function useAccountGraph(accountId: string) {
  return useQuery<AccountKnowledgeGraph>({
    queryKey: ['account-graph', accountId],
    queryFn: () => fetchAccountKnowledgeGraph(accountId),
    enabled: !!accountId,
    staleTime: 30_000, // 30s — account graphs don't change rapidly
  })
}
