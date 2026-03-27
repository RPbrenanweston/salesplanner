/** @id salesblock.hooks.use-backlinks */
import { useQuery } from '@tanstack/react-query'
import { fetchBacklinks } from '../lib/queries/graphQueries'
import type { Backlink, GraphNodeType } from '../types/graph'

export function useBacklinks(entityType: GraphNodeType, entityId: string) {
  return useQuery<Backlink[]>({
    queryKey: ['backlinks', entityType, entityId],
    queryFn: () => fetchBacklinks(entityType, entityId),
    enabled: !!entityId,
  })
}
