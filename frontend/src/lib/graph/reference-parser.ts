/** @id salesblock.lib.graph.reference-parser */
import type { ParsedReference, ParsedTag, ParseResult, GraphNodeType } from '../../types/graph'

const VALID_ENTITY_TYPES: GraphNodeType[] = [
  'account', 'contact', 'deal', 'note_block', 'signal', 'activity', 'research_entry',
]

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

// Matches [[type:uuid:display text]]
const REFERENCE_REGEX = new RegExp(
  `\\[\\[(${VALID_ENTITY_TYPES.join('|')}):` +
  `(${UUID_PATTERN}):` +
  `([^\\]]+)\\]\\]`,
  'gi'
)

// Matches #tag-name (letters, numbers, hyphens, underscores)
const TAG_REGEX = /#([\w-]+)/g

/**
 * Parse note content for [[wikilink]] references and #tags.
 * Returns structured references, tags, and stripped plain text.
 */
export function parseNoteContent(content: string): ParseResult {
  const references: ParsedReference[] = []
  const tags: ParsedTag[] = []

  // Reset regex lastIndex for safety
  REFERENCE_REGEX.lastIndex = 0
  TAG_REGEX.lastIndex = 0

  // Extract references
  let match: RegExpExecArray | null
  while ((match = REFERENCE_REGEX.exec(content)) !== null) {
    const entityType = match[1].toLowerCase() as GraphNodeType
    if (VALID_ENTITY_TYPES.includes(entityType)) {
      references.push({
        entityType,
        entityId: match[2],
        displayText: match[3],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      })
    }
  }

  // Extract tags
  while ((match = TAG_REGEX.exec(content)) !== null) {
    // Ensure tag isn't inside a [[reference]]
    const isInsideRef = references.some(
      (ref) => match!.index >= ref.startIndex && match!.index < ref.endIndex
    )
    if (!isInsideRef) {
      tags.push({
        tagName: match[1].toLowerCase(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      })
    }
  }

  // Build plain text by stripping reference syntax → display text only
  const plainText = content
    .replace(REFERENCE_REGEX, '$3')
    .replace(TAG_REGEX, '$1')

  return { references, tags, plainText }
}

/**
 * Build the stored reference format: [[type:uuid:display text]]
 */
export function buildReference(entityType: GraphNodeType, entityId: string, displayText: string): string {
  return `[[${entityType}:${entityId}:${displayText}]]`
}

/**
 * Render content with references replaced by display text (for read-only views).
 */
export function renderPlainText(content: string): string {
  REFERENCE_REGEX.lastIndex = 0
  return content.replace(REFERENCE_REGEX, '$3')
}

/**
 * Extract unique entity IDs from parsed references, grouped by type.
 */
export function groupReferencesByType(refs: ParsedReference[]): Map<GraphNodeType, string[]> {
  const grouped = new Map<GraphNodeType, string[]>()
  for (const ref of refs) {
    const existing = grouped.get(ref.entityType) || []
    if (!existing.includes(ref.entityId)) {
      existing.push(ref.entityId)
    }
    grouped.set(ref.entityType, existing)
  }
  return grouped
}
