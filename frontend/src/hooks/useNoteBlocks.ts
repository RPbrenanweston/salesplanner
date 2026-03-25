/** @id salesblock.hooks.use-note-blocks */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchNoteBlocksForAccount,
  saveNoteWithReferences,
  deleteNoteBlock,
} from '../lib/queries/graphQueries'
import type { NoteBlock } from '../types/graph'

export function useNoteBlocks(accountId: string, contactId?: string) {
  return useQuery<NoteBlock[]>({
    queryKey: ['note-blocks', accountId, contactId],
    queryFn: () => fetchNoteBlocksForAccount(accountId, { contactId }),
    enabled: !!accountId,
  })
}

export function useSaveNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: {
      noteId?: string
      orgId: string
      accountId: string
      contactId?: string | null
      content: string
      createdBy: string
    }) => saveNoteWithReferences(params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['note-blocks', variables.accountId] })
      queryClient.invalidateQueries({ queryKey: ['backlinks'] })
      queryClient.invalidateQueries({ queryKey: ['account-graph', variables.accountId] })
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { noteId: string; accountId: string }) =>
      deleteNoteBlock(params.noteId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['note-blocks', variables.accountId] })
      queryClient.invalidateQueries({ queryKey: ['backlinks'] })
      queryClient.invalidateQueries({ queryKey: ['account-graph', variables.accountId] })
    },
  })
}
