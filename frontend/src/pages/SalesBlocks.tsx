import { useState } from 'react'
import { Plus } from 'lucide-react'
import { CreateSalesBlockModal } from '../components/CreateSalesBlockModal'

export default function SalesBlocks() {
  const [showCreateModal, setShowCreateModal] = useState(false)

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

      {/* TODO: US-018 will add salesblock list/tabs here */}

      <CreateSalesBlockModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          // TODO: Refresh salesblocks list when US-018 implemented
        }}
      />
    </div>
  )
}
