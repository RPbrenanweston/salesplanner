/**
 * @crumb
 * @id frontend-component-create-salesblock-modal
 * @area UI/SalesBlocks
 * @intent Create SalesBlock modal — form to create a new SalesBlock (named outreach unit) with optional calendar event for a kickoff meeting
 * @responsibilities Render SalesBlock creation form (name, description, target company, assigned contacts), optionally create a calendar event at creation time, insert into salesblocks table, call onCreated callback
 * @contracts CreateSalesBlockModal({ onClose, onCreated }) → JSX; calls supabase.from('salesblocks').insert; optionally calls createCalendarEvent from lib/calendar; uses useAuth for org_id + user_id
 * @in useAuth (org_id, user_id), supabase salesblocks table, lib/calendar.createCalendarEvent (optional), onClose callback, onCreated callback
 * @out New salesblock row in salesblocks table associated to org_id + user_id; optional calendar event created; onCreated called with new salesblock; modal closed
 * @err Supabase insert failure (caught, error shown); createCalendarEvent failure if calendar not connected (caught, salesblock created without calendar event)
 * @hazard createCalendarEvent is called inside the salesblock creation flow — if it fails and the error is not surfaced, the user may not know their kickoff calendar event was never created, leading to a missing meeting
 * @hazard salesblocks are inserted with user_id from useAuth — if useAuth returns null user (race condition on auth state), the insert will fail or create an unowned salesblock depending on DB constraints
 * @shared-edges frontend/src/hooks/useAuth.ts→READS org_id + user_id; frontend/src/lib/calendar.ts→CALLS createCalendarEvent; supabase salesblocks table→INSERTS to; parent page (Lists or Dashboard)→RENDERS modal
 * @trail create-salesblock#1 | User clicks "New SalesBlock" → CreateSalesBlockModal renders → user fills form → handleCreate → supabase insert → optionally createCalendarEvent → onCreated(newBlock) → modal closes
 * @prompt Guard createCalendarEvent failure separately from salesblock insert. Validate user is authenticated before rendering form. Show explicit calendar event creation status.
 */
import { useState, useEffect } from 'react'
import { X, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useUserLists, useCallScripts, useUserTeamInfo, useTeamMembers, useUserProfile } from '../hooks'
import { createCalendarEvent } from '../lib/calendar'
import { DURATION, SALESBLOCK_STATUS, USER_ROLE } from '../lib/constants'

interface CreateSalesBlockModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  preSelectedListId?: string // Optional: pre-select a list (e.g., from List detail page)
}

export function CreateSalesBlockModal({ isOpen, onClose, onSuccess, preSelectedListId }: CreateSalesBlockModalProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  // Data hooks (handles caching + loading)
  const { data: lists = [] } = useUserLists(isOpen && user?.id ? user.id : undefined)
  const { data: scripts = [] } = useCallScripts(isOpen ? user?.id : undefined)
  const { data: userTeamInfo } = useUserTeamInfo(isOpen && user?.id ? user.id : undefined)
  const { data: teamMembers } = useTeamMembers(userTeamInfo?.team_id ?? null, user?.id)
  const { data: userProfile } = useUserProfile(user?.id)

  const isManager = userTeamInfo?.role === USER_ROLE.MANAGER

  // Form fields
  const [selectedListId, setSelectedListId] = useState(preSelectedListId || '')
  const [selectedScriptId, setSelectedScriptId] = useState('')
  const [title, setTitle] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [duration, setDuration] = useState(String(DURATION.DEFAULT_SALESBLOCK_MINUTES))
  const [assignedToUserId, setAssignedToUserId] = useState('') // Empty = assign to self

  // Auto-generate title when list or date changes
  useEffect(() => {
    if (selectedListId && scheduledDate) {
      const selectedList = lists.find(l => l.id === selectedListId)
      if (selectedList) {
        const date = new Date(scheduledDate)
        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        setTitle(`${selectedList.name} - ${formattedDate}`)
      }
    }
  }, [selectedListId, scheduledDate, lists])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedListId || !scheduledDate || !scheduledTime || !userProfile?.org_id) return

    setLoading(true)

    try {
      // Combine date and time into ISO timestamp
      const scheduledStart = new Date(`${scheduledDate}T${scheduledTime}`)
      const scheduledEnd = new Date(scheduledStart.getTime() + parseInt(duration) * 60000)

      // Determine user_id and assigned_by
      const targetUserId = assignedToUserId || user.id
      const assignedBy = assignedToUserId ? user.id : null

      // Get list name for calendar event description
      const selectedList = lists.find(l => l.id === selectedListId)
      const listName = selectedList?.name || 'Unknown List'

      // Get contact count for calendar event description
      const { count: contactCount } = await supabase
        .from('list_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', selectedListId)

      // Create salesblock record
      const { data: salesblockData, error } = await supabase
        .from('salesblocks')
        .insert({
          org_id: userProfile.org_id,
          list_id: selectedListId,
          user_id: targetUserId,
          assigned_by: assignedBy,
          title,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          duration_minutes: parseInt(duration),
          status: SALESBLOCK_STATUS.SCHEDULED,
          script_id: selectedScriptId || null
        })
        .select()
        .single()

      if (error) throw error

      // Create calendar event (async, non-blocking)
      const calendarResult = await createCalendarEvent({
        title: `SalesBlock: ${title}`,
        description: `List: ${listName}\nContacts: ${contactCount || 0}\nDuration: ${duration} minutes`,
        start: scheduledStart.toISOString(),
        end: scheduledEnd.toISOString(),
      })

      // Update salesblock with calendar_event_id and provider if successful
      if (calendarResult && salesblockData) {
        await supabase
          .from('salesblocks')
          .update({
            calendar_event_id: calendarResult.eventId,
            calendar_provider: calendarResult.provider
          })
          .eq('id', salesblockData.id)
      }

      alert('SalesBlock created successfully!')
      resetAndClose()
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Error creating salesblock:', error)
      alert('Failed to create SalesBlock. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function resetAndClose() {
    setSelectedListId(preSelectedListId || '')
    setSelectedScriptId('')
    setTitle('')
    setScheduledDate('')
    setScheduledTime('')
    setDuration(String(DURATION.DEFAULT_SALESBLOCK_MINUTES))
    setAssignedToUserId('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create SalesBlock</h2>
          </div>
          <button onClick={resetAndClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* List Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              List
            </label>
            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select a list</option>
              {lists.map(list => (
                <option key={list.id} value={list.id}>{list.name}</option>
              ))}
            </select>
          </div>

          {/* Title (auto-generated) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Auto-generated from list name + date"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
              min={new Date().toISOString().split('T')[0]}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time
            </label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="15">15 minutes</option>
              <option value="25">25 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>

          {/* Call Script (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Call Script (optional)
            </label>
            <select
              value={selectedScriptId}
              onChange={(e) => setSelectedScriptId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">No script</option>
              {scripts.map(script => (
                <option key={script.id} value={script.id}>{script.name}</option>
              ))}
            </select>
          </div>

          {/* Assign To (manager only) */}
          {isManager && Array.isArray(teamMembers) && teamMembers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assign To
              </label>
              <select
                value={assignedToUserId}
                onChange={(e) => setAssignedToUserId(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Myself</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.display_name} ({member.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={resetAndClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedListId || !scheduledDate || !scheduledTime}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create SalesBlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
