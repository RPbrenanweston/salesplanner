import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Play } from 'lucide-react'
import { CreateSalesBlockModal } from '../components/CreateSalesBlockModal'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface SalesBlock {
  id: string
  title: string
  scheduled_start: string
  scheduled_end: string
  duration_minutes: number
  status: string
  list_id: string
}

export default function SalesBlocks() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [salesblocks, setSalesblocks] = useState<SalesBlock[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()

  const loadSalesblocks = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('salesblocks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .order('scheduled_start', { ascending: true })

      if (error) throw error
      setSalesblocks(data || [])
    } catch (error) {
      console.error('Error loading salesblocks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSalesblocks()
  }, [user])

  const handleStart = (salesblockId: string) => {
    navigate(`/salesblocks/${salesblockId}/session`)
  }

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            SalesBlocks
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your timed focus sessions
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create SalesBlock
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      ) : salesblocks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No scheduled salesblocks</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Create your first SalesBlock
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {salesblocks.map((sb) => (
            <div
              key={sb.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 flex items-center justify-between bg-white dark:bg-gray-800"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {sb.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatDateTime(sb.scheduled_start)} • {sb.duration_minutes} min
                </p>
              </div>
              <button
                onClick={() => handleStart(sb.id)}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Play className="w-5 h-5" />
                Start
              </button>
            </div>
          ))}
        </div>
      )}

      <CreateSalesBlockModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          loadSalesblocks()
        }}
      />
    </div>
  )
}
