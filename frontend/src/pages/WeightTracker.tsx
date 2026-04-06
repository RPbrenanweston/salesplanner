import { Scale } from 'lucide-react'
import { useThemeConfig } from '../providers/ThemeProvider'

export default function WeightTracker() {
  const { name } = useThemeConfig()

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Scale className="w-7 h-7 text-indigo-electric" />
        <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
          Weight Tracker
        </h1>
      </div>
      <p className="text-gray-500 dark:text-white/50 mb-8">
        Log your measurements and celebrate progress. Coming soon to {name}.
      </p>
      <div className="glass-card p-6 text-center">
        <p className="text-4xl mb-4">📊</p>
        <p className="font-display font-semibold text-gray-900 dark:text-white mb-2">
          Progress Measurement Tracker
        </p>
        <p className="text-sm text-gray-500 dark:text-white/40">
          Track weight, measurements, and body composition alongside your wellness sessions.
        </p>
      </div>
    </div>
  )
}
