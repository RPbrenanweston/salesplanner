import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboardData } from '../hooks/useDashboardData'
import { useGoalProgress } from '../hooks/useGoalProgress'
import { CreateSalesBlockModal } from '../components/CreateSalesBlockModal'
import { DashboardGreeting } from '../components/dashboard-greeting'
import { TodaysSalesBlocksSection } from '../components/todays-salesblocks-section'
import { ActivityFeedSection } from '../components/activity-feed-section'
import { GoalProgressSection } from '../components/goal-progress-section'
import { UpcomingSalesBlocksSection } from '../components/upcoming-salesblocks-section'

export default function Home() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const navigate = useNavigate()

  const { userDisplayName, todaysSalesblocks, upcomingSalesblocks, recentActivities, loading, refreshData } = useDashboardData()
  const { goalProgress } = useGoalProgress()

  const handleStartBlock = (salesblockId: string) => {
    navigate(`/salesblocks/${salesblockId}/session`)
  }

  const handleScheduleBlock = () => {
    setShowCreateModal(true)
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-500 dark:text-gray-400">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Greeting Section */}
      <DashboardGreeting userDisplayName={userDisplayName} />

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Today's SalesBlocks + Activity Feed */}
        <div className="lg:col-span-2 space-y-6">
          <TodaysSalesBlocksSection
            salesblocks={todaysSalesblocks}
            onStartBlock={handleStartBlock}
            onScheduleBlock={handleScheduleBlock}
          />
          <ActivityFeedSection activities={recentActivities} />
        </div>

        {/* Right Column - Goal Progress + Upcoming SalesBlocks */}
        <div className="space-y-6">
          <GoalProgressSection goals={goalProgress} />
          <UpcomingSalesBlocksSection salesblocks={upcomingSalesblocks} />
        </div>
      </div>

      {/* Create SalesBlock Modal */}
      <CreateSalesBlockModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          refreshData()
        }}
      />
    </div>
  )
}
