import { Loader } from 'lucide-react'

export default function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <Loader className="w-12 h-12 text-blue-500 animate-spin" />
        </div>
        <p className="text-slate-300 font-medium">Loading...</p>
      </div>
    </div>
  )
}
