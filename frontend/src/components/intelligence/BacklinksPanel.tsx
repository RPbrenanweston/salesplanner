/** @id salesblock.component.intelligence.backlinks-panel */
import { Link2, FileText, User, Building2, Briefcase, Zap, Activity, ChevronRight, Loader2 } from 'lucide-react'
import { useBacklinks } from '../../hooks/useBacklinks'
import type { GraphNodeType, Backlink } from '../../types/graph'

interface BacklinksPanelProps {
  entityType: GraphNodeType
  entityId: string
  entityLabel?: string
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  note_block: FileText,
  contact: User,
  account: Building2,
  deal: Briefcase,
  signal: Zap,
  activity: Activity,
}

const TYPE_LABELS: Record<string, string> = {
  note_block: 'Notes',
  contact: 'Contacts',
  account: 'Accounts',
  deal: 'Deals',
  signal: 'Signals',
  activity: 'Activities',
  research_entry: 'Research',
}

const TYPE_COLORS: Record<string, string> = {
  note_block: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  contact: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  account: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  deal: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  signal: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  activity: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  research_entry: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
}

function groupBacklinks(backlinks: Backlink[]): Map<string, Backlink[]> {
  const grouped = new Map<string, Backlink[]>()
  for (const bl of backlinks) {
    const existing = grouped.get(bl.source_type) || []
    existing.push(bl)
    grouped.set(bl.source_type, existing)
  }
  return grouped
}

export function BacklinksPanel({ entityType, entityId, entityLabel }: BacklinksPanelProps) {
  const { data: backlinks, isLoading } = useBacklinks(entityType, entityId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-3">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading backlinks...
      </div>
    )
  }

  if (!backlinks || backlinks.length === 0) {
    return (
      <div className="py-3">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Link2 className="w-4 h-4" />
          <span>No backlinks yet</span>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          Other notes and signals that reference {entityLabel || 'this entity'} will appear here.
        </p>
      </div>
    )
  }

  const grouped = groupBacklinks(backlinks)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Backlinks
        </h3>
        <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
          {backlinks.length}
        </span>
      </div>

      {Array.from(grouped.entries()).map(([sourceType, items]) => {
        const Icon = TYPE_ICONS[sourceType] || FileText
        const colorClasses = TYPE_COLORS[sourceType] || 'text-gray-400 bg-gray-500/10 border-gray-500/20'

        return (
          <div key={sourceType}>
            <div className="flex items-center gap-2 mb-1.5">
              <Icon className={`w-3.5 h-3.5 ${colorClasses.split(' ')[0]}`} />
              <span className="text-xs font-medium text-gray-400 uppercase">
                {TYPE_LABELS[sourceType] || sourceType}
              </span>
              <span className="text-xs text-gray-600">{items.length}</span>
            </div>

            <div className="space-y-1 ml-5">
              {items.map((bl) => (
                <div
                  key={bl.edge_id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded border cursor-pointer hover:brightness-110 transition ${colorClasses}`}
                >
                  <span className="text-xs truncate flex-1">
                    {bl.source_label || bl.source_id.slice(0, 8)}
                  </span>
                  <span className="text-[10px] text-gray-500 shrink-0">
                    {bl.edge_type}
                  </span>
                  <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
