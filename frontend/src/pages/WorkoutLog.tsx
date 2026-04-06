import { Dumbbell } from 'lucide-react'
import { useThemeConfig } from '../providers/ThemeProvider'

export default function WorkoutLog() {
  const { name } = useThemeConfig()

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Dumbbell className="w-7 h-7 text-indigo-electric" />
        <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
          Workout Log
        </h1>
      </div>
      <p className="text-gray-500 dark:text-white/50 mb-8">
        Track every session, set, and rep. Coming soon to {name}.
      </p>
      <div className="glass-card p-6 text-center">
        <p className="text-4xl mb-4">🏋️</p>
        <p className="font-display font-semibold text-gray-900 dark:text-white mb-2">
          Training Session Log
        </p>
        <p className="text-sm text-gray-500 dark:text-white/40">
          Log workouts, track PRs, and monitor recovery alongside your planning sessions.
        </p>
      </div>
    </div>
  )
}
