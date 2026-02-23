import { useState, useEffect } from 'react'
import { X, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface CreateSalesBlockModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  preSelectedListId?: string // Optional: pre-select a list (e.g., from List detail page)
}

interface List {
  id: string
  name: string
}

interface TeamMember {
  id: string
  display_name: string
  email: string
}

interface CallScript {
  id: string
  name: string
}

export function CreateSalesBlockModal({ isOpen, onClose, onSuccess, preSelectedListId }: CreateSalesBlockModalProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [lists, setLists] = useState<List[]>([])
  const [scripts, setScripts] = useState<CallScript[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isManager, setIsManager] = useState(false)

  // Form fields
  const [selectedListId, setSelectedListId] = useState(preSelectedListId || '')
  const [selectedScriptId, setSelectedScriptId] = useState('')
  const [title, setTitle] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [duration, setDuration] = useState('30')
  const [assignedToUserId, setAssignedToUserId] = useState('') // Empty = assign to self

  // Load user's lists, scripts, and check if manager
  useEffect(() => {
    if (isOpen && user) {
      loadLists()
      loadScripts()
      checkManagerStatus()
    }
  }, [isOpen, user])

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

  async function loadLists() {
    const { data, error } = await supabase
      .from('lists')
      .select('id, name')
      .or(`owner_id.eq.${user?.id},is_shared.eq.true`)
      .order('name')

    if (error) {
      console.error('Error loading lists:', error)
    } else {
      setLists(data || [])
      if (preSelectedListId) {
        setSelectedListId(preSelectedListId)
      }
    }
  }

  async function loadScripts() {
    const { data, error } = await supabase
      .from('call_scripts')
      .select('id, name')
      .order('name')

    if (error) {
      console.error('Error loading scripts:', error)
    } else {
      setScripts(data || [])
    }
  }

  async function checkManagerStatus() {
    const { data, error } = await supabase
      .from('users')
      .select('role, team_id')
      .eq('id', user?.id)
      .single()

    if (error) {
      console.error('Error checking manager status:', error)
      return
    }

    const isManagerRole = data.role === 'manager'
    setIsManager(isManagerRole)

    // If manager, load team members
    if (isManagerRole && data.team_id) {
      const { data: members, error: membersError } = await supabase
        .from('users')
        .select('id, display_name, email')
        .eq('team_id', data.team_id)
        .neq('id', user?.id) // Exclude self

      if (membersError) {
        console.error('Error loading team members:', membersError)
      } else {
        setTeamMembers(members || [])
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedListId || !scheduledDate || !scheduledTime) return

    setLoading(true)

    try {
      // Combine date and time into ISO timestamp
      const scheduledStart = new Date(`${scheduledDate}T${scheduledTime}`)
      const scheduledEnd = new Date(scheduledStart.getTime() + parseInt(duration) * 60000)

      // Get org_id from user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (userError) throw userError

      // Determine user_id and assigned_by
      const targetUserId = assignedToUserId || user.id
      const assignedBy = assignedToUserId ? user.id : null

      const { error } = await supabase
        .from('salesblocks')
        .insert({
          org_id: userData.org_id,
          list_id: selectedListId,
          user_id: targetUserId,
          assigned_by: assignedBy,
          title,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          duration_minutes: parseInt(duration),
          status: 'scheduled',
          script_id: selectedScriptId || null
        })

      if (error) throw error

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
    setDuration('30')
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
          {isManager && teamMembers.length > 0 && (
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
                {teamMembers.map(member => (
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
