// @crumb frontend-page-pipeline
// UI/PAGES | load_deals_by_stage | render_kanban_columns | drag_drop_stage_update | add_deal_modal | deal_value_totals
// why: Kanban deal pipeline — drag-and-drop deal management across configurable stages with deal value tracking
// in:supabase(deals table with stage field),AddDealModal,@hello-pangea/dnd out:kanban board with stage columns,deal cards(contact name,value,close date),drag to update stage err:Supabase update failure on drop(no rollback),deal load failure(empty board)
// hazard: @hello-pangea/dnd has React 18 StrictMode double-invocation issue — drag events may fire twice causing duplicate stage updates
// hazard: No optimistic rollback on failed stage update — UI shows new stage but DB has old stage (silent desync)
// edge:frontend/src/components/AddDealModal.tsx -> CALLS
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:pipeline#1 -> STEP_IN
// prompt: Add optimistic rollback for failed stage updates. Investigate StrictMode double-fire. Add deal value total in column header. Verify org_id scoping.
import { useState, useEffect, useRef, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Plus, DollarSign, Calendar, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AddDealModal from '../components/AddDealModal'
import DealDetailModal from '../components/DealDetailModal'

interface PipelineStage {
  id: string
  name: string
  color: string
  position: number
  probability: number
}

interface Deal {
  id: string
  title: string
  value: number
  currency: string
  close_date: string | null
  stage_id: string
  created_at: string
  contacts: {
    first_name: string
    last_name: string
    company: string | null
  }
}

interface StageColumn {
  stage: PipelineStage
  deals: Deal[]
  totalValue: number
  count: number
}

export default function Pipeline() {
  const [columns, setColumns] = useState<StageColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDealModalOpen, setIsAddDealModalOpen] = useState(false)
  const [selectedStageId, setSelectedStageId] = useState<string | undefined>()
  const [isDealDetailModalOpen, setIsDealDetailModalOpen] = useState(false)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)

  // StrictMode double-fire guard: tracks in-flight drag operations by draggableId
  const dragInFlightRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    loadPipeline()
  }, [])

  async function loadPipeline() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (!userData) return

      // Load stages
      const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('org_id', userData.org_id)
        .order('position')

      if (!stages) return

      // Load deals with contact info
      const { data: deals } = await supabase
        .from('deals')
        .select(`
          *,
          contacts (
            first_name,
            last_name,
            company
          )
        `)
        .eq('org_id', userData.org_id)
        .limit(500)

      if ((deals?.length ?? 0) >= 500) {
        console.warn('loadPipeline: hit 500-record limit — pagination needed')
      }

      if (!deals) return

      // Organize deals into stage columns
      const columnsData: StageColumn[] = stages.map((stage) => {
        const stageDeals = deals.filter((deal) => deal.stage_id === stage.id).map(deal => ({
          ...deal,
          contacts: Array.isArray(deal.contacts) ? deal.contacts[0] : deal.contacts
        }))
        const totalValue = stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0)

        return {
          stage,
          deals: stageDeals,
          totalValue,
          count: stageDeals.length
        }
      })

      setColumns(columnsData)
    } catch (error) {
      console.error('Error loading pipeline:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = useCallback(async function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    // StrictMode double-fire guard: skip if this drag is already in-flight
    if (dragInFlightRef.current.has(draggableId)) return
    dragInFlightRef.current.add(draggableId)

    const sourceColumn = columns.find(col => col.stage.id === source.droppableId)
    const destColumn = columns.find(col => col.stage.id === destination.droppableId)

    if (!sourceColumn || !destColumn) {
      dragInFlightRef.current.delete(draggableId)
      return
    }

    const deal = sourceColumn.deals.find(d => d.id === draggableId)
    if (!deal) {
      dragInFlightRef.current.delete(draggableId)
      return
    }

    // Snapshot previous state for rollback
    const previousColumns = columns

    // Optimistically update UI
    const newColumns = columns.map(col => {
      if (col.stage.id === source.droppableId) {
        const newDeals = col.deals.filter(d => d.id !== draggableId)
        return {
          ...col,
          deals: newDeals,
          count: newDeals.length,
          totalValue: newDeals.reduce((sum, d) => sum + (d.value || 0), 0)
        }
      }
      if (col.stage.id === destination.droppableId) {
        const newDeals = [...col.deals]
        newDeals.splice(destination.index, 0, { ...deal, stage_id: destination.droppableId })
        return {
          ...col,
          deals: newDeals,
          count: newDeals.length,
          totalValue: newDeals.reduce((sum, d) => sum + (d.value || 0), 0)
        }
      }
      return col
    })

    setColumns(newColumns)

    // Update in database
    try {
      const { error } = await supabase
        .from('deals')
        .update({ stage_id: destination.droppableId })
        .eq('id', draggableId)

      if (error) {
        console.error('Error updating deal stage:', error)
        // Rollback to snapshot instead of refetching
        setColumns(previousColumns)
      }
    } catch (error) {
      console.error('Error updating deal:', error)
      setColumns(previousColumns)
    } finally {
      dragInFlightRef.current.delete(draggableId)
    }
  }, [columns])

  function openAddDealModal(stageId?: string) {
    setSelectedStageId(stageId)
    setIsAddDealModalOpen(true)
  }

  function openDealDetail(dealId: string) {
    setSelectedDealId(dealId)
    setIsDealDetailModalOpen(true)
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  function getDaysInStage(createdAt: string) {
    const created = new Date(createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Forecast calculations
  const totalPipelineValue = columns.reduce((sum, col) => sum + col.totalValue, 0)

  const weightedForecast = columns.reduce((sum, col) => {
    const stageWeightedValue = col.deals.reduce((dealSum, deal) => {
      const probability = col.stage.probability / 100
      return dealSum + (deal.value * probability)
    }, 0)
    return sum + stageWeightedValue
  }, 0)

  const dealsClosingThisMonth = columns.reduce((count, col) => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const monthDeals = col.deals.filter(deal => {
      if (!deal.close_date) return false
      const closeDate = new Date(deal.close_date)
      return closeDate.getMonth() === currentMonth && closeDate.getFullYear() === currentYear
    })

    return count + monthDeals.length
  }, 0)

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 dark:text-white/40">
          <div className="w-5 h-5 border-2 border-indigo-electric border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm tracking-widest uppercase">Loading Pipeline...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="vv-section-title mb-1">Revenue</p>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">Pipeline</h1>
        </div>
        <button
          onClick={() => openAddDealModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-electric hover:bg-indigo-electric/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
        >
          <Plus className="w-4 h-4" />
          Add Deal
        </button>
      </div>

      {/* Forecast Bar */}
      <div className="glass-card p-6">
        <h2 className="font-display text-base font-semibold text-gray-900 dark:text-white mb-4">Revenue Forecast</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col">
            <div className="vv-section-title mb-1">Total Pipeline Value</div>
            <div className="font-mono text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(totalPipelineValue)}
            </div>
          </div>
          <div className="flex flex-col">
            <div className="vv-section-title mb-1">Weighted Forecast</div>
            <div className="font-mono text-2xl font-bold text-indigo-electric">
              {formatCurrency(weightedForecast)}
            </div>
            <div className="text-xs text-gray-400 dark:text-white/30 font-mono mt-1">
              Based on stage probabilities
            </div>
          </div>
          <div className="flex flex-col">
            <div className="vv-section-title mb-1">Closing This Month</div>
            <div className="font-mono text-2xl font-bold text-emerald-signal">
              {dealsClosingThisMonth} {dealsClosingThisMonth === 1 ? 'deal' : 'deals'}
            </div>
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <div
              key={column.stage.id}
              className="flex-shrink-0 w-80 glass-card"
            >
              {/* Column Header */}
              <div className="p-4 border-b border-gray-200 dark:border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: column.stage.color }}
                    />
                    <h3 className="font-display font-semibold text-gray-900 dark:text-white">
                      {column.stage.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => openAddDealModal(column.stage.id)}
                    className="text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white transition-colors duration-150 ease-snappy"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm text-gray-500 dark:text-white/40 font-mono">
                  {column.count} {column.count === 1 ? 'deal' : 'deals'} • {formatCurrency(column.totalValue)}
                </div>
              </div>

              {/* Droppable Area */}
              <Droppable droppableId={column.stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`p-4 space-y-3 min-h-[200px] ${
                      snapshot.isDraggingOver ? 'bg-indigo-electric/5 dark:bg-indigo-electric/10' : ''
                    }`}
                  >
                    {column.deals.map((deal, index) => (
                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => openDealDetail(deal.id)}
                            className={`bg-white dark:bg-white/5 rounded-lg p-4 border border-gray-200 dark:border-white/10 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-all duration-150 ease-snappy ${
                              snapshot.isDragging ? 'shadow-lg ring-2 ring-indigo-electric' : ''
                            }`}
                          >
                            <h4 className="font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                              {deal.title}
                            </h4>

                            <div className="space-y-1 text-sm text-gray-500 dark:text-white/50">
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5" />
                                <span className="truncate">
                                  {deal.contacts.first_name} {deal.contacts.last_name}
                                </span>
                              </div>

                              {deal.contacts.company && (
                                <div className="flex items-center gap-2">
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span className="truncate">{deal.contacts.company}</span>
                                </div>
                              )}

                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-white/10">
                                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                                  {formatCurrency(deal.value)}
                                </span>
                                {deal.close_date && (
                                  <div className="flex items-center gap-1 text-xs">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(deal.close_date)}
                                  </div>
                                )}
                              </div>

                              <div className="text-xs text-gray-400 dark:text-white/30 font-mono mt-1">
                                {getDaysInStage(deal.created_at)} days in stage
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {column.deals.length === 0 && (
                      <div className="text-center py-8 text-sm text-gray-400 dark:text-white/30">
                        No deals in this stage
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <AddDealModal
        isOpen={isAddDealModalOpen}
        onClose={() => {
          setIsAddDealModalOpen(false)
          setSelectedStageId(undefined)
        }}
        onSuccess={() => {
          loadPipeline()
          setIsAddDealModalOpen(false)
          setSelectedStageId(undefined)
        }}
        initialStageId={selectedStageId}
      />

      <DealDetailModal
        isOpen={isDealDetailModalOpen}
        onClose={() => {
          setIsDealDetailModalOpen(false)
          setSelectedDealId(null)
        }}
        dealId={selectedDealId}
        onUpdate={loadPipeline}
      />
    </div>
  )
}
