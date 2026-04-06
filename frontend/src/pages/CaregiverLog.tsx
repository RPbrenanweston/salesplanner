import { Heart } from 'lucide-react'
import { useThemeConfig } from '../providers/ThemeProvider'

export default function CaregiverLog() {
  const { name } = useThemeConfig()

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Heart className="w-7 h-7 text-indigo-electric" />
        <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
          Caregiver Log
        </h1>
      </div>
      <p className="text-gray-500 dark:text-white/50 mb-8">
        Keep notes and schedules for the people you care for. Coming soon to {name}.
      </p>
      <div className="glass-card p-6 text-center">
        <p className="text-4xl mb-4">💝</p>
        <p className="font-display font-semibold text-gray-900 dark:text-white mb-2">
          Care Schedule & Notes
        </p>
        <p className="text-sm text-gray-500 dark:text-white/40">
          Track appointments, medications, mood logs, and daily care notes for the people who need you.
        </p>
      </div>
    </div>
  )
}
