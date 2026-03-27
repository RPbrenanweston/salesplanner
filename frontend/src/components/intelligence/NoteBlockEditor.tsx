/** @id salesblock.component.intelligence.note-block-editor */
import { useState, useCallback, useRef, useEffect } from 'react'
import { Plus, Send, X, FileText, User, Building2, Briefcase, Hash, Loader2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useSaveNote, useNoteBlocks, useDeleteNote } from '../../hooks/useNoteBlocks'
import { searchEntitiesForReference } from '../../lib/queries/graphQueries'
import { buildReference, parseNoteContent } from '../../lib/graph/reference-parser'
import type { GraphNodeType, NoteBlock } from '../../types/graph'

interface NoteBlockEditorProps {
  accountId: string
  orgId: string
  contactId?: string
}

interface AutocompleteResult {
  type: GraphNodeType
  id: string
  label: string
}

const TYPE_ICONS: Record<string, typeof Building2> = {
  account: Building2,
  contact: User,
  deal: Briefcase,
}

const TYPE_COLORS: Record<string, string> = {
  account: 'text-blue-400',
  contact: 'text-emerald-400',
  deal: 'text-amber-400',
}

export function NoteBlockEditor({ accountId, orgId, contactId }: NoteBlockEditorProps) {
  const { user } = useAuth()
  const { data: notes, isLoading } = useNoteBlocks(accountId, contactId)
  const saveNote = useSaveNote()
  const deleteNote = useDeleteNote()

  const [content, setContent] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteQuery, setAutocompleteQuery] = useState('')
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteResult[]>([])
  const [autocompleteLoading, setAutocompleteLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Detect [[ trigger for autocomplete
  const handleContentChange = useCallback((value: string, isEdit: boolean) => {
    if (isEdit) {
      setEditContent(value)
    } else {
      setContent(value)
    }

    // Check if cursor is after [[
    const cursorPos = (isEdit ? editTextareaRef : textareaRef).current?.selectionStart ?? value.length
    const textBeforeCursor = value.slice(0, cursorPos)
    const lastDoubleBracket = textBeforeCursor.lastIndexOf('[[')

    if (lastDoubleBracket >= 0) {
      const textAfterBracket = textBeforeCursor.slice(lastDoubleBracket + 2)
      // Only show autocomplete if no closing ]] yet and reasonable query length
      if (!textAfterBracket.includes(']]') && textAfterBracket.length >= 0 && textAfterBracket.length < 50) {
        setAutocompleteQuery(textAfterBracket)
        setShowAutocomplete(true)
        setSelectedIndex(0)
        return
      }
    }

    setShowAutocomplete(false)
  }, [])

  // Search for entities when autocomplete query changes
  useEffect(() => {
    if (!showAutocomplete || autocompleteQuery.length < 1) {
      setAutocompleteResults([])
      return
    }

    const timer = setTimeout(async () => {
      setAutocompleteLoading(true)
      try {
        const results = await searchEntitiesForReference(orgId, autocompleteQuery)
        setAutocompleteResults(results)
      } catch {
        setAutocompleteResults([])
      }
      setAutocompleteLoading(false)
    }, 200)

    return () => clearTimeout(timer)
  }, [autocompleteQuery, showAutocomplete, orgId])

  // Insert selected entity reference
  const insertReference = useCallback((result: AutocompleteResult, isEdit: boolean) => {
    const ref = buildReference(result.type, result.id, result.label)
    const currentContent = isEdit ? editContent : content
    const textarea = (isEdit ? editTextareaRef : textareaRef).current
    const cursorPos = textarea?.selectionStart ?? currentContent.length
    const textBeforeCursor = currentContent.slice(0, cursorPos)
    const lastDoubleBracket = textBeforeCursor.lastIndexOf('[[')

    if (lastDoubleBracket >= 0) {
      const newContent =
        currentContent.slice(0, lastDoubleBracket) +
        ref +
        currentContent.slice(cursorPos)

      if (isEdit) {
        setEditContent(newContent)
      } else {
        setContent(newContent)
      }
    }

    setShowAutocomplete(false)
    setAutocompleteQuery('')
  }, [content, editContent])

  // Handle keyboard navigation in autocomplete
  const handleKeyDown = useCallback((e: React.KeyboardEvent, isEdit: boolean) => {
    if (!showAutocomplete || autocompleteResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, autocompleteResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && showAutocomplete) {
      e.preventDefault()
      insertReference(autocompleteResults[selectedIndex], isEdit)
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false)
    }
  }, [showAutocomplete, autocompleteResults, selectedIndex, insertReference])

  // Save new note
  const handleSave = useCallback(async () => {
    if (!content.trim() || !user) return

    await saveNote.mutateAsync({
      orgId,
      accountId,
      contactId: contactId || null,
      content: content.trim(),
      createdBy: user.id,
    })

    setContent('')
    setIsAdding(false)
  }, [content, user, orgId, accountId, contactId, saveNote])

  // Save edit
  const handleSaveEdit = useCallback(async (noteId: string) => {
    if (!editContent.trim() || !user) return

    await saveNote.mutateAsync({
      noteId,
      orgId,
      accountId,
      contactId: contactId || null,
      content: editContent.trim(),
      createdBy: user.id,
    })

    setEditingId(null)
    setEditContent('')
  }, [editContent, user, orgId, accountId, contactId, saveNote])

  // Delete note
  const handleDelete = useCallback(async (noteId: string) => {
    await deleteNote.mutateAsync({ noteId, accountId })
  }, [deleteNote, accountId])

  // Render note content with clickable references
  const renderContent = (noteContent: string) => {
    const { references } = parseNoteContent(noteContent)
    if (references.length === 0) return <span>{noteContent}</span>

    const parts: React.ReactNode[] = []
    let lastIndex = 0

    for (const ref of references) {
      if (ref.startIndex > lastIndex) {
        parts.push(<span key={`t-${lastIndex}`}>{noteContent.slice(lastIndex, ref.startIndex)}</span>)
      }
      const Icon = TYPE_ICONS[ref.entityType] || FileText
      const color = TYPE_COLORS[ref.entityType] || 'text-gray-400'
      parts.push(
        <span
          key={`r-${ref.startIndex}`}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition ${color}`}
          title={`${ref.entityType}: ${ref.displayText}`}
        >
          <Icon className="w-3 h-3" />
          <span className="text-sm font-medium">{ref.displayText}</span>
        </span>
      )
      lastIndex = ref.endIndex
    }

    if (lastIndex < noteContent.length) {
      parts.push(<span key={`t-${lastIndex}`}>{noteContent.slice(lastIndex)}</span>)
    }

    return <>{parts}</>
  }

  // Render tags from content
  const renderTags = (noteContent: string) => {
    const { tags } = parseNoteContent(noteContent)
    if (tags.length === 0) return null

    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs"
          >
            <Hash className="w-3 h-3" />
            {tag.tagName}
          </span>
        ))}
      </div>
    )
  }

  // Autocomplete dropdown
  const renderAutocomplete = (isEdit: boolean) => {
    if (!showAutocomplete) return null

    return (
      <div className="absolute z-50 mt-1 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
        {autocompleteLoading ? (
          <div className="p-3 text-gray-400 text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Searching...
          </div>
        ) : autocompleteResults.length === 0 ? (
          <div className="p-3 text-gray-500 text-sm">
            {autocompleteQuery.length < 1 ? 'Type to search...' : 'No results found'}
          </div>
        ) : (
          autocompleteResults.map((result, i) => {
            const Icon = TYPE_ICONS[result.type] || FileText
            const color = TYPE_COLORS[result.type] || 'text-gray-400'
            return (
              <button
                key={`${result.type}-${result.id}`}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition ${
                  i === selectedIndex ? 'bg-blue-600/30 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertReference(result, isEdit)
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="truncate">{result.label}</span>
                <span className="ml-auto text-xs text-gray-500 capitalize">{result.type}</span>
              </button>
            )
          })
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Notes
        </h3>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Note
          </button>
        )}
      </div>

      {/* New note form */}
      {isAdding && (
        <div className="relative bg-gray-800/50 border border-gray-700 rounded-lg p-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value, false)}
            onKeyDown={(e) => handleKeyDown(e, false)}
            placeholder="Type a note... Use [[ to link entities, # for tags"
            className="w-full bg-transparent text-gray-200 text-sm placeholder-gray-500 outline-none resize-none min-h-[80px]"
            autoFocus
          />
          {renderAutocomplete(false)}
          <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-gray-700">
            <button
              onClick={() => { setIsAdding(false); setContent(''); setShowAutocomplete(false) }}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim() || saveNote.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded transition"
            >
              {saveNote.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading notes...
        </div>
      ) : !notes || notes.length === 0 ? (
        <p className="text-gray-500 text-sm italic py-2">
          No notes yet — click Add Note to start building knowledge
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((note: NoteBlock) => (
            <div
              key={note.id}
              className="group bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 hover:border-gray-600/50 transition"
            >
              {editingId === note.id ? (
                <div className="relative">
                  <textarea
                    ref={editTextareaRef}
                    value={editContent}
                    onChange={(e) => handleContentChange(e.target.value, true)}
                    onKeyDown={(e) => handleKeyDown(e, true)}
                    className="w-full bg-transparent text-gray-200 text-sm outline-none resize-none min-h-[60px]"
                    autoFocus
                  />
                  {renderAutocomplete(true)}
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button
                      onClick={() => { setEditingId(null); setShowAutocomplete(false) }}
                      className="p-1 text-gray-400 hover:text-gray-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSaveEdit(note.id)}
                      disabled={saveNote.isPending}
                      className="p-1 text-blue-400 hover:text-blue-300"
                    >
                      {saveNote.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-sm text-gray-200 leading-relaxed">
                    {renderContent(note.content)}
                  </div>
                  {renderTags(note.content)}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/30">
                    <span className="text-xs text-gray-500">
                      {new Date(note.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                      {note.source !== 'manual' && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                          {note.source}
                        </span>
                      )}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                      <button
                        onClick={() => { setEditingId(note.id); setEditContent(note.content) }}
                        className="p-1 text-gray-400 hover:text-gray-200"
                        title="Edit"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-1 text-gray-400 hover:text-red-400"
                        title="Delete"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
